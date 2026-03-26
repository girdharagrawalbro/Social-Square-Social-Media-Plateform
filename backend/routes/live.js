const express = require('express');
const router = express.Router();
const LiveStream = require('../models/LiveStream');
const verifyToken = require('../middleware/Verifytoken');

// Get active live streams
router.get('/active', verifyToken, async (req, res) => {
    try {
        const activeStreams = await LiveStream.find({ status: 'active' })
            .populate('host', 'fullname profile_picture')
            .sort({ startTime: -1 });
        res.json(activeStreams);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start a live stream
router.post('/start', verifyToken, async (req, res) => {
    try {
        // Check if user already has an active stream
        await LiveStream.updateMany({ host: req.user._id, status: 'active' }, { status: 'ended', endTime: Date.now() });

        const stream = new LiveStream({
            host: req.user._id,
            title: req.body.title || `${req.user.fullname}'s Live Stream`
        });
        await stream.save();
        
        const populated = await stream.populate('host', 'fullname profile_picture');
        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// End a live stream
router.post('/end/:id', verifyToken, async (req, res) => {
    try {
        const stream = await LiveStream.findOneAndUpdate(
            { _id: req.params.id, host: req.user._id },
            { status: 'ended', endTime: Date.now() },
            { new: true }
        );
        res.json(stream);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
