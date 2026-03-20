const express = require('express');
const router = express.Router();
const { generateCaptionFromImage, detectMoodFromCaption } = require('../utils/gemini');
const Post = require('../models/Post');

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
// Returns posts filtered/sorted by mood matching user's recent mood
router.get('/mood-feed/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { mood } = req.query; // mood passed from frontend

        if (!mood) return res.status(400).json({ error: 'mood is required' });

        // Mood compatibility map — similar moods grouped
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

        // Find posts with matching mood, not time-locked, not expired
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