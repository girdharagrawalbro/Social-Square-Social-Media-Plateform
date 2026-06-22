const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const { PostVector, CommentVector } = require('../models/Recommendation');
const { getEmbedding } = require('../utils/embeddings');
const { generateText } = require('../utils/gemini');

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://girdharagrawalbro:7909905038@cluster0.czsb19m.mongodb.net/socialsquare?retryWrites=true&w=majority&appName=Cluster0";
const CONCURRENCY = Number(process.env.CLASSIFY_CONCURRENCY || 2);

// Helper: Call NVIDIA Chat API
async function generateFromNvidia(prompt) {
    return generateText(prompt, { maxTokens: 256, temperature: 0.1 });
}

function cleanAndParseJson(text) {
    try {
        if (!text) return null;
        let cleanText = text.trim();
        cleanText = cleanText.replace(/^```json/i, '').replace(/```$/i, '').trim();
        const start = cleanText.indexOf('{');
        const end = cleanText.lastIndexOf('}');
        if (start === -1 || end === -1) return null;
        return JSON.parse(cleanText.substring(start, end + 1));
    } catch (e) {
        return null;
    }
}

// ─── POST PROCESSING ──────────────────────────────────────────────────────────

async function processPost(post) {
    let updated = false;

    // 1. Generate AI Summary (if missing)
    if (!post.aiSummary && post.caption && post.caption.length > 10) {
        const prompt = `Summarize this post in 1-2 concise, highly engaging sentences for a quick hover-preview popup. Capture the core idea or question.
Text: ${post.caption}
Tags: ${post.tags?.join(', ') || 'None'}
Output only the summary text, nothing else.`;
        const summary = await generateFromNvidia(prompt);
        if (summary && summary.length > 5) {
            post.aiSummary = summary;
            await post.save();
            updated = true;
            console.log(`📝 Post [${post._id}] Summary: ${summary.substring(0, 50)}...`);
        }
    }

    // 2. Generate Post Vector (if missing)
    const existingVector = await PostVector.findOne({ postId: post._id });
    if (!existingVector) {
        const textToEmbed = `${post.category || ''} ${post.tags?.join(' ') || ''} ${post.caption || ''}`.trim();
        if (textToEmbed) {
            const embedding = await getEmbedding(textToEmbed);
            if (embedding) {
                await PostVector.create({
                    postId: post._id,
                    userId: post.user?._id,
                    embedding,
                    category: post.category || 'General',
                    type: post.video ? 'video' : (post.image_url || post.image_urls?.length ? 'image' : 'text')
                });
                console.log(`✅ Post [${post._id}] Vectorized`);
                updated = true;
            }
        }
    }

    return updated;
}

// ─── COMMENT PROCESSING ───────────────────────────────────────────────────────

async function processComment(comment) {
    let updated = false;

    // 1. Generate Quality, Topic, and Best Answer Score (if missing/default)
    if (comment.topic === 'General' && comment.quality === 'normal' && comment.content && comment.content.length > 5) {
        const prompt = `Analyze this comment.
Comment: "${comment.content}"

Respond in JSON format with exact keys:
{
  "topic": "Extract a 1-3 word primary topic/concept",
  "quality": "high" | "normal" | "low",
  "isInsightful": boolean (true if highly educational/detailed)
}
Only output valid JSON.`;

        const response = await generateFromNvidia(prompt);
        const parsed = cleanAndParseJson(response);
        if (parsed) {
            comment.topic = parsed.topic || 'General';
            comment.quality = parsed.quality || 'normal';
            comment.isInsightful = parsed.isInsightful || false;

            // Basic heuristic for best answer: high likes, high quality
            if (parsed.quality === 'high' && comment.likes?.length > 5) {
                comment.isBestAnswer = true;
            }

            await comment.save();
            updated = true;
            console.log(`💬 Comment [${comment._id}] AI Analyzed: ${comment.quality} | ${comment.topic}`);
        }
    }

    // 2. Generate Comment Vector (if missing)
    const existingVector = await CommentVector.findOne({ commentId: comment._id });
    if (!existingVector && comment.content) {
        const embedding = await getEmbedding(comment.content);
        if (embedding) {
            await CommentVector.create({
                commentId: comment._id,
                postId: comment.postId,
                userId: comment.user?._id,
                embedding,
                topic: comment.topic || 'General',
                quality: comment.quality || 'normal'
            });
            console.log(`✅ Comment [${comment._id}] Vectorized`);
            updated = true;
        }
    }

    return updated;
}

// ─── RUNNER ───────────────────────────────────────────────────────────────────

async function main() {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n--- 🚀 PROCESSING POSTS ---');
    let postsProcessed = 0;
    const posts = await Post.find({ deletedAt: null, isVisible: true }).sort({ createdAt: -1 });
    console.log(`Found ${posts.length} active posts.`);

    for (let i = 0; i < posts.length; i += CONCURRENCY) {
        const batch = posts.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(processPost));
        postsProcessed += batch.length;
        if (postsProcessed % 10 === 0) console.log(`Processed ${postsProcessed} / ${posts.length} posts...`);
    }

    console.log('\n--- 🚀 PROCESSING COMMENTS ---');
    let commentsProcessed = 0;
    const comments = await Comment.find({ isVisible: true }).sort({ createdAt: -1 });
    console.log(`Found ${comments.length} active comments.`);

    for (let i = 0; i < comments.length; i += CONCURRENCY) {
        const batch = comments.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(processComment));
        commentsProcessed += batch.length;
        if (commentsProcessed % 10 === 0) console.log(`Processed ${commentsProcessed} / ${comments.length} comments...`);
    }

    console.log('\n🎉 ALL DONE! Backfill complete.');
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
