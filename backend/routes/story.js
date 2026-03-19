const express = require('express');
const Story = require('../models/Story');
const User = require('../models/User');
const router = express.Router();

// ─── CREATE STORY ─────────────────────────────────────────────────────────────
router.post('/create', async (req, res) => {
    try {
        const { userId, mediaUrl, mediaType, text } = req.body;
        if (!userId || !mediaUrl || !mediaType) return res.status(400).json({ message: 'userId, mediaUrl and mediaType are required.' });

        const user = await User.findById(userId).select('fullname profile_picture');
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const story = new Story({
            user: { _id: user._id, fullname: user.fullname, profile_picture: user.profile_picture },
            media: { url: mediaUrl, type: mediaType },
            text: text || {},
        });
        await story.save();
        res.status(201).json(story);
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// ─── GET STORIES FEED (from followed users + own) ─────────────────────────────
router.get('/feed/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).select('following');
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const userIds = [userId, ...user.following.map(id => id.toString())];

        // Group stories by user
        const stories = await Story.find({
            'user._id': { $in: userIds },
            expiresAt: { $gt: new Date() },
        }).sort({ createdAt: -1 });

        // Group by userId
        const grouped = {};
        stories.forEach(story => {
            const uid = story.user._id.toString();
            if (!grouped[uid]) {
                grouped[uid] = {
                    user: story.user,
                    stories: [],
                    hasUnviewed: false,
                };
            }
            grouped[uid].stories.push(story);
            if (!story.viewers.includes(userId)) grouped[uid].hasUnviewed = true;
        });

        // Own stories first, then others
        const result = Object.values(grouped).sort((a, b) => {
            if (a.user._id.toString() === userId) return -1;
            if (b.user._id.toString() === userId) return 1;
            return b.hasUnviewed - a.hasUnviewed;
        });

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── MARK STORY AS VIEWED ─────────────────────────────────────────────────────
router.post('/view/:storyId', async (req, res) => {
    try {
        const { userId } = req.body;
        await Story.findByIdAndUpdate(req.params.storyId, {
            $addToSet: { viewers: userId }
        });
        res.status(200).json({ message: 'Viewed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── DELETE STORY ─────────────────────────────────────────────────────────────
router.delete('/:storyId', async (req, res) => {
    try {
        const { userId } = req.body;
        const story = await Story.findById(req.params.storyId);
        if (!story) return res.status(404).json({ message: 'Story not found.' });
        if (story.user._id.toString() !== userId) return res.status(403).json({ message: 'Unauthorized.' });
        await Story.findByIdAndDelete(req.params.storyId);
        res.status(200).json({ message: 'Story deleted.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;