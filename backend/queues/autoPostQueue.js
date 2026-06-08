const { Queue, Worker } = require('bullmq');
const User = require('../models/User');
const Post = require('../models/Post');
const Category = require('../models/Category');
const SystemSetting = require('../models/SystemSetting');
const redis = require('../lib/redis');
const { generateNvidiaText, generateNvidiaImage } = require('../utils/nvidia');
const { detectMoodFromCaption } = require('../utils/gemini');
const axios = require('../utils/http');

const isRedisDisabled = process.env.DISABLE_REDIS === 'true';

// ─── QUEUE ────────────────────────────────────────────────────────────────────
const autoPostQueue = !isRedisDisabled ? new Queue('autoPost', { connection: redis }) : null;

// ─── HELPER: CLOUDINARY UPLOAD ────────────────────────────────────────────────
async function uploadGeneratedImageToCloudinary(imageBuffer) {
    if (!imageBuffer) {
        throw new Error('No image buffer provided for upload');
    }
    try {
        let cloudApiBase = (process.env.CLOUDINARY_API_BASE_URL || 'http://localhost:5001').replace(/\/+$/, '');
        if (cloudApiBase.endsWith('/api/cloudinary')) {
            cloudApiBase = cloudApiBase.slice(0, -'/api/cloudinary'.length).replace(/\/+$/, '');
        }
        const cloudRes = await axios.post(
            `${cloudApiBase}/api/cloudinary/upload-base64`,
            {
                file: `data:image/png;base64,${imageBuffer.toString('base64')}`
            },
            { headers: { 'Content-Type': 'application/json' } }
        );
        const secureUrl = cloudRes.data?.data?.secure_url;
        if (cloudRes.data?.success === false || !secureUrl) {
            throw new Error(cloudRes.data?.message || 'Invalid Cloudinary upload response');
        }
        return secureUrl;
    } catch (error) {
        const reason = error.response?.data?.message || error.response?.data?.error?.message || error.message;
        throw new Error(`Cloudinary upload failed: ${reason}`);
    }
}

// ─── HELPER: FIND OR CREATE AI USER ──────────────────────────────────────────
async function getOrCreateAiUser() {
    let aiUser = await User.findOne({ username: 'social_square_ai' });
    if (!aiUser) {
        aiUser = await User.create({
            fullname: 'Social Square AI',
            username: 'social_square_ai',
            email: 'ai@social-square.me',
            password: 'AiUserSuperSecretPassword2026!',
            authProvider: 'local',
            isEmailVerified: true,
            profile_picture: 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778490037/logo_eyc3at.jpg',
            bio: 'Official Social Square AI bot posting twice daily! 🤖✨',
            creatorTier: 'pro'
        });
        console.log(`[AutoPost] Created AI User: ${aiUser.username}`);
    }
    return aiUser;
}

// ─── HELPER: DOUBLE POST PROTECTION (4 HOURS WINDOW) ──────────────────────────
async function checkRecentPost(aiUserId) {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const recentPost = await Post.findOne({
        'user._id': aiUserId,
        createdAt: { $gte: fourHoursAgo }
    });
    return !!recentPost;
}

// ─── EXECUTE AUTO POST JOB ────────────────────────────────────────────────────
async function runAutoPostJob(force = false) {
    try {
        // 1. Check feature flag setting
        if (!force) {
            const flagSetting = await SystemSetting.findOne({ key: 'ai_auto_posting' }).lean();
            if (flagSetting && flagSetting.value === false) {
                console.log('[AutoPost] Skipped: AI auto-posting is disabled via system settings.');
                return null;
            }
        }

        // 2. Get AI User
        const aiUser = await getOrCreateAiUser();

        // 3. Double-post protection
        if (!force) {
            const hasPostedRecently = await checkRecentPost(aiUser._id);
            if (hasPostedRecently) {
                console.log('[AutoPost] Skipped: AI User already posted in the last 4 hours.');
                return null;
            }
        }

        console.log('[AutoPost] Beginning post generation sequence...');

        // 4. Select Category
        // Fetch the last 6 posts by this AI user to check recent categories
        const recentPosts = await Post.find({ 'user._id': aiUser._id })
            .sort({ createdAt: -1 })
            .limit(6)
            .select('category')
            .lean();
        const recentCategories = recentPosts.map(p => p.category);

        const categories = await Category.find().select('category').lean();
        let categoryList = categories.map(c => c.category).filter(Boolean);
        if (categoryList.length === 0) {
            categoryList = ['Nature', 'Travel', 'Technology', 'Lifestyle', 'Fitness', 'Food', 'Fashion', 'Music', 'Gaming', 'Comedy'];
        }

        // Ensure "Comedy" is in our list representing funny memes
        if (!categoryList.some(c => c.toLowerCase() === 'comedy')) {
            categoryList.push('Comedy');
        }

        // 65% probability of Comedy/Meme post
        const isComedyMeme = Math.random() < 0.65;
        let randomCategory;

        if (isComedyMeme) {
            randomCategory = 'Comedy';
        } else {
            // Find categories excluding 'Comedy' and excluding recently used ones to guarantee rotation/diversity
            let rotatedChoices = categoryList.filter(
                c => c.toLowerCase() !== 'comedy' && !recentCategories.includes(c)
            );

            // If all categories were recently used, just exclude Comedy
            if (rotatedChoices.length === 0) {
                rotatedChoices = categoryList.filter(c => c.toLowerCase() !== 'comedy');
            }

            // Fallback if still empty
            if (rotatedChoices.length === 0) {
                rotatedChoices = ['Nature', 'Travel', 'Technology', 'Lifestyle', 'Fitness', 'Food', 'Fashion', 'Music', 'Gaming'];
            }

            randomCategory = rotatedChoices[Math.floor(Math.random() * rotatedChoices.length)];
        }

        // Ensure category exists in Category model
        const matchedDbCategory = categoryList.find(c => c.toLowerCase() === randomCategory.toLowerCase());
        const actualCategoryName = matchedDbCategory || randomCategory;
        const existingCategory = await Category.findOne({ category: actualCategoryName });
        if (!existingCategory) {
            await Category.create({ category: actualCategoryName });
        }

        console.log(`[AutoPost] Chosen Category: ${actualCategoryName}`);

        // 5. Generate Flux Image Prompt
        let themePrompt;
        if (actualCategoryName === 'Comedy') {
            themePrompt = `Generate a detailed prompt for a funny, quirky, and highly relatable meme illustration or cartoon. It should be humorous, visual, and engaging. Return ONLY the description, nothing else.`;
        } else {
            themePrompt = `Generate a highly detailed, cinematic prompt for an AI image generator (Flux model). The theme is "${actualCategoryName}". The prompt should describe a stunning, vibrant scene. Return ONLY the description, nothing else.`;
        }

        const promptResult = await generateNvidiaText(themePrompt);
        const imagePrompt = promptResult.text.trim() || `A beautiful high-quality scene depicting ${actualCategoryName}`;

        console.log(`[AutoPost] Generated Flux Image Prompt: "${imagePrompt}"`);

        // 6. Generate Image
        const imageResult = await generateNvidiaImage(imagePrompt);
        if (!imageResult || !imageResult.buffer) {
            throw new Error('Image generation returned empty buffer');
        }

        // 7. Upload to Cloudinary
        const imageUrl = await uploadGeneratedImageToCloudinary(imageResult.buffer);
        console.log(`[AutoPost] Cloudinary URL: ${imageUrl}`);

        // 8. Generate Caption
        let captionPrompt;
        if (actualCategoryName === 'Comedy') {
            captionPrompt = `Write a hilarious, witty caption or joke (under 150 characters) in Hinglish (Hindi written using Latin/English characters) to go with this meme concept: "${imagePrompt}". Keep it extremely funny, relatable, and short. Do not use hashtags or markdown. Return ONLY the Hinglish text.`;
        } else {
            captionPrompt = `Write an engaging, creative social media caption in Hinglish (Hindi written using Latin/English characters) for a post featuring an image of: "${imagePrompt}". The caption should match the category: "${actualCategoryName}". Keep it under 200 characters. Do not use hashtags or markdown. Return ONLY the Hinglish caption text.`;
        }

        const captionResult = await generateNvidiaText(captionPrompt);
        const rawCaption = captionResult.text.trim() || `Stunning view of ${actualCategoryName}! ✨`;

        // 9. Generate hashtags
        const tagPrompt = `Based on this caption: "${rawCaption}", suggest 3 to 5 relevant hashtags. Return ONLY the hashtags separated by spaces, nothing else.`;
        const tagResult = await generateNvidiaText(tagPrompt);
        const hashtags = tagResult.text.trim().split(/\s+/).filter(t => t.startsWith('#')).slice(0, 5);

        const finalCaption = hashtags.length > 0 ? `${rawCaption}\n\n${hashtags.join(' ')}` : rawCaption;

        // 10. Detect Mood
        const mood = await detectMoodFromCaption(rawCaption);

        // 11. Create Post
        const newPost = await Post.create({
            caption: finalCaption,
            category: actualCategoryName,
            image_urls: [imageUrl],
            user: {
                _id: aiUser._id,
                fullname: aiUser.fullname,
                profile_picture: aiUser.profile_picture
            },
            mood,
            isAiGenerated: true,
            authorId: aiUser._id
        });

        // 12. Update User posts count
        await User.findByIdAndUpdate(aiUser._id, { $inc: { postsCount: 1 } });

        // 13. Publish to PubSub so subscribers distribute the post to all users
        try {
            const { publish } = require('../lib/pubsub');
            await publish('posts.created', {
                id: newPost._id,
                user: {
                    _id: aiUser._id,
                    username: aiUser.username,
                    fullname: aiUser.fullname,
                    profile_picture: aiUser.profile_picture
                },
                category: newPost.category,
                isAi: true
            });
            console.log('[AutoPost] Published posts.created event successfully');
        } catch (pubErr) {
            console.warn('[AutoPost] Failed to publish posts.created event:', pubErr.message);
        }

        console.log(`🎉 [AutoPost] Successfully created AI auto-post with ID: ${newPost._id}`);
        return newPost;
    } catch (err) {
        console.error('❌ [AutoPost] Job Failed:', err.message);
        throw err;
    }
}

// ─── FALLBACK TIMER CHECK ─────────────────────────────────────────────────────
async function checkAndTriggerAutoPost() {
    const now = new Date();
    const currentHour = now.getHours(); // Local hour

    // Run at 9:00 AM (9) and 6:00 PM (18)
    if (currentHour === 9 || currentHour === 18) {
        console.log(`[AutoPost] Local hour matches ${currentHour}:00. Checking auto-post requirements...`);
        await runAutoPostJob();
    }
}

// ─── SCHEDULE AUTO POST repeatable jobs ───────────────────────────────────────
async function scheduleAutoPost() {
    if (isRedisDisabled || !autoPostQueue) {
        console.log('[AutoPost] BullMQ Skipped (Redis disabled). Internal timer fallback online.');

        // Check local time every hour
        setInterval(async () => {
            try {
                await checkAndTriggerAutoPost();
            } catch (e) {
                console.error('[AutoPost] Fallback Schedule Error:', e.message);
            }
        }, 60 * 60 * 1000);
        return;
    }
    try {
        const jobs = await autoPostQueue.getRepeatableJobs();
        for (const job of jobs) {
            await autoPostQueue.removeRepeatableByKey(job.key);
        }

        // Run every day at 9:00 AM local time (Cron format, timezone can be specified or uses local)
        await autoPostQueue.add('morning-post', {}, {
            repeat: { cron: '0 9 * * *' },
            removeOnComplete: true,
        });

        // Run every day at 6:00 PM (18:00) local time
        await autoPostQueue.add('evening-post', {}, {
            repeat: { cron: '0 18 * * *' },
            removeOnComplete: true,
        });

        console.log('[AutoPost] Scheduled both morning (9:00 AM) and evening (6:00 PM) repeatable jobs.');
    } catch (err) {
        console.warn('[AutoPost] Failed to schedule repeatable jobs:', err.message);
    }
}

// ─── WORKER ───────────────────────────────────────────────────────────────────
let worker = null;

if (!isRedisDisabled) {
    worker = new Worker('autoPost', async (job) => {
        console.log(`[AutoPost] Worker executing job: ${job.name}`);
        await runAutoPostJob();
    }, {
        connection: redis,
        concurrency: 1,
        limiter: { max: 1, duration: 5000 },
        stalledInterval: 12 * 60 * 60 * 1000
    });

    worker.on('failed', (job, err) => console.error('[AutoPost] Worker job failed:', err.message));
}

module.exports = { autoPostQueue, scheduleAutoPost, runAutoPostJob };
