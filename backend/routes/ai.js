const express = require('express');
const router = express.Router();
const { generateCaptionFromImage, detectMoodFromCaption } = require('../utils/gemini');
const { generateNvidiaText, generateNvidiaImage } = require('../utils/nvidia');
const Post = require('../models/Post');
const axios = require('axios');
const FormData = require('form-data');

// ─── HELPER: CHECK AI LIMIT ───────────────────────────────────────────────────
async function checkAiLimit(userId) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const count = await Post.countDocuments({
        'user._id': userId,
        isAiGenerated: true,
        createdAt: { $gte: twentyFourHoursAgo }
    });
    return count;
}

// ─── GENERATE TEXT (NVIDIA w/ Fallback) ───────────────────────────────────────
router.post('/generate-text', async (req, res) => {
    try {
        const { prompt, userId } = req.body;
        if (!prompt) return res.status(400).json({ error: 'prompt is required' });
        if (!userId) return res.status(400).json({ error: 'userId is required' });

        const count = await checkAiLimit(userId);
        if (count >= 2) {
            return res.status(429).json({ error: 'Daily limit of 2 AI posts reached.' });
        }

        const { text, model } = await generateNvidiaText(prompt);
        res.status(200).json({ text, model, remaining: 2 - count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── GENERATE IMAGE (NVIDIA w/ Fallback) ──────────────────────────────────────
router.post('/generate-image', async (req, res) => {
    try {
        const { prompt, userId } = req.body;
        if (!prompt) return res.status(400).json({ error: 'prompt is required' });
        if (!userId) return res.status(400).json({ error: 'userId is required' });

        const count = await checkAiLimit(userId);
        if (count >= 2) {
            return res.status(429).json({ error: 'Daily limit of 2 AI posts reached.' });
        }

        // Generate image buffer from NVIDIA
        const { buffer: imageBuffer, model } = await generateNvidiaImage(prompt);

        // Upload to Cloudinary using unsigned preset (as seen in frontend)
        const formData = new FormData();
        formData.append('file', `data:image/jpeg;base64,${imageBuffer.toString('base64')}`);
        formData.append('upload_preset', 'socialsquare');
        
        const cloudRes = await axios.post(`https://api.cloudinary.com/v1_1/dcmrsdydr/image/upload`, formData, {
            headers: { ...formData.getHeaders() }
        });

        res.status(200).json({ 
            imageUrl: cloudRes.data.secure_url, 
            model,
            remaining: 2 - count 
        });
    } catch (error) {
        console.error('[AI Image Route Error]:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to generate or upload image' });
    }
});

// ─── GET AI REMAINING LIMIT ───────────────────────────────────────────────────
router.get('/limit/:userId', async (req, res) => {
    try {
        const count = await checkAiLimit(req.params.userId);
        res.json({ count, limit: 2, remaining: Math.max(0, 2 - count) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── GENERATE CAPTION FROM IMAGE ─────────────────────────────────────────────
router.post('/caption', async (req, res) => {
    try {
        const { imageUrl } = req.body;
        if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });

        const captions = await generateCaptionFromImage(imageUrl);
        if (!captions) return res.status(500).json({ error: 'Failed to generate captions' });

        res.status(200).json({ captions });
    } catch (error) {
        console.error('Caption route error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── MOOD-BASED FEED ──────────────────────────────────────────────────────────
router.get('/mood-feed/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { mood } = req.query;

        if (!mood) return res.status(400).json({ error: 'mood is required' });

        const moodGroups = {
            happy: ['happy', 'excited', 'funny'],
            sad: ['sad', 'nostalgic'],
            excited: ['excited', 'happy', 'inspirational'],
            angry: ['angry'],
            calm: ['calm', 'neutral'],
            romantic: ['romantic'],
            funny: ['funny', 'happy'],
            inspirational: ['inspirational', 'excited'],
            nostalgic: ['nostalgic', 'sad'],
            neutral: ['neutral', 'calm', 'happy'],
        };

        const relatedMoods = moodGroups[mood] || [mood, 'neutral'];

        const moodPosts = await Post.find({
            mood: { $in: relatedMoods },
            $or: [{ unlocksAt: null }, { unlocksAt: { $lte: new Date() } }],
            $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
        }).sort({ score: -1, createdAt: -1 }).limit(20);

        res.status(200).json({ posts: moodPosts, mood, relatedMoods });
    } catch (error) {
        console.error('Mood feed error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── DETECT MOOD FROM CAPTION ─────────────────────────────────────────────────
router.post('/detect-mood', async (req, res) => {
    try {
        const { caption } = req.body;
        if (!caption) return res.status(400).json({ error: 'caption is required' });

        const mood = await detectMoodFromCaption(caption);
        res.status(200).json({ mood });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;