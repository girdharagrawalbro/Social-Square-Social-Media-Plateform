const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const axios = require('axios');
const User = require('../models/User');
const Post = require('../models/Post');

const MONGO_URI = "mongodb+srv://girdharagrawalbro:7909905038@cluster0.czsb19m.mongodb.net/socialsquare?retryWrites=true&w=majority&appName=Cluster0";
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'qwen2.5:3b';
const CONCURRENCY = 2;

async function checkOllama() {
    try {
        await axios.get('http://localhost:11434/');
        console.log(`✅ Ollama is running (Using model: ${OLLAMA_MODEL})`);
        return true;
    } catch {
        console.error('❌ Ollama is not running on http://localhost:11434');
        return false;
    }
}

async function generateFromOllama(prompt, system = '') {
    try {
        const res = await axios.post(OLLAMA_URL, {
            model: OLLAMA_MODEL,
            prompt,
            system,
            stream: false,
            options: { temperature: 0.2 }
        }, { timeout: 30000 });
        return res.data.response.trim();
    } catch (err) {
        console.error(`[Ollama Error]`, err.message);
        return null;
    }
}

async function processUser(user) {
    // 1. Fetch latest 5 posts by this user
    const posts = await Post.find({ 'user._id': user._id, deletedAt: null })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('caption tags category')
        .lean();

    if (posts.length === 0) {
        console.log(`ℹ️ User ${user.fullname} (@${user.username}) has no posts. Skipping.`);
        return;
    }

    const postsSummaryText = posts
        .map((p, i) => `Post ${i+1}: "${p.caption || ''}" (Category: ${p.category || 'General'}, Tags: ${p.tags?.join(', ') || 'None'})`)
        .join('\n');

    const prompt = `You are a social media analyst. Analyze the following posts from the user named "${user.fullname}" (@${user.username}) and write a warm, engaging 1-2 sentence profile insight of their vibe, top interests, or style. 

Do NOT say "The user posts about..." or "Based on their posts...". Instead, write a direct, catchy, and premium bio insight. Keep it strictly under 30 words.

User Posts:
${postsSummaryText}

Insight:`;

    const summary = await generateFromOllama(prompt, 'You generate short, accurate, and catchy personality summaries for social media profile cards.');
    if (summary && summary.length > 5) {
        user.aiProfileSummary = summary;
        await user.save();
        console.log(`✨ Generated AI Profile Summary for ${user.fullname}: "${summary}"`);
    } else {
        console.warn(`⚠️ Failed to generate summary for ${user.fullname}`);
    }
}

async function main() {
    const isOllamaUp = await checkOllama();
    if (!isOllamaUp) process.exit(1);

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const users = await User.find({ deletedAt: null });
    console.log(`👥 Found ${users.length} active users to process.`);

    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        console.log(`[${i + 1}/${users.length}] Processing ${user.fullname}...`);
        try {
            await processUser(user);
        } catch (e) {
            console.error(`❌ Error processing user ${user.fullname}:`, e.message);
        }
    }

    console.log('🎉 AI User Profile Backfill Complete!');
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('❌ Critical Error:', err);
    process.exit(1);
});
