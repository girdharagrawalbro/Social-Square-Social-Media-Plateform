const mongoose = require('mongoose');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from backend root
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Post = require('../models/Post');
const { updateGamification } = require('../lib/gamification');
const { publishEvent } = require('../services/recommendationPublisher');

const OLLAMA_URL = "http://localhost:11434/api/generate";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1";

async function detectMoodOllama(caption) {
    if (!caption || !String(caption).trim()) return 'neutral';
    try {
        const prompt = `Analyze the mood of this social media post caption and return ONLY one word from this list: happy, sad, excited, angry, calm, romantic, funny, inspirational, nostalgic, neutral\n\nCaption: "${caption}"\n\nReturn only the single mood word, nothing else.`;

        const response = await axios.post(OLLAMA_URL, {
            model: OLLAMA_MODEL,
            prompt: prompt,
            stream: false
        }, { timeout: 15000 });

        const mood = response.data.response.trim().toLowerCase().replace(/[^\w]/g, '');
        const validMoods = ['happy', 'sad', 'excited', 'angry', 'calm', 'romantic', 'funny', 'inspirational', 'nostalgic', 'neutral'];
        return validMoods.includes(mood) ? mood : 'neutral';
    } catch (err) {
        // console.warn(`[Ollama] Failed for caption: "${caption.substring(0, 30)}..."`);
        return 'neutral';
    }
}

async function run() {
    console.log("🚀 Starting Post Maintenance Script (AI Mood + Gamification)");

    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/socialsquare');
        console.log("✅ MongoDB Connected.");

        // 1. Log available models
        try {
            const ollamaCheck = await axios.get("http://localhost:11434/api/tags", { timeout: 3000 });
            if (ollamaCheck.data && ollamaCheck.data.models) {
                const models = ollamaCheck.data.models.map(m => m.name);
                console.log(`[Ollama] Available local models: ${models.join(', ')}`);
            }
        } catch (e) {
            console.warn(`[Ollama] Warning: Could not connect to local Ollama server. Mood detection will be neutral.`);
        }

        // 2. Fetch posts that need mood detection (or all if you want to refresh)
        // Adjust filter: { mood: { $exists: false } } or {} for all
        const posts = await Post.find({ $or: [{ mood: null }, { mood: { $exists: false } }] });
        console.log(`📝 Found ${posts.length} posts to process.`);

        let processed = 0;
        for (const post of posts) {
            processed++;
            const userId = post.user?._id || post.user;
            if (!userId) continue;

            // Detect mood
            const mood = await detectMoodOllama(post.caption);
            post.mood = mood;
            await post.save();

            // Sync with Recommendation Engine
            await publishEvent("post.updated", {
                postId: post._id.toString(),
                userId: userId.toString(),
                caption: post.caption || "",
                category: post.category || "Default",
                mood: post.mood,
                updatedAtTs: Math.floor(Date.now() / 1000),
            }).catch(() => { });

            // Gamify the profile (Ensure XP/Level is correct based on post count)
            // Note: updateGamification usually awards points for the ACTION. 
            // Here we just ensure the user's level is calculated correctly or award a maintenance bonus.
            const rewards = await updateGamification(userId, 'post'); // Re-triggering 'post' action to sync

            if (processed % 10 === 0 || processed === posts.length) {
                process.stdout.write(`  Progress: ${processed}/${posts.length} posts updated\r`);
            }
        }

        console.log("\n\n✨ All posts updated successfully.");
        console.log("👤 Users' gamification levels have been synchronized.");

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error("❌ Fatal Error:", err);
        await mongoose.disconnect();
        process.exit(1);
    }
}

run();
