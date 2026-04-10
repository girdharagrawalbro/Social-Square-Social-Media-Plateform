const express = require('express');
const router = express.Router();
const LiveStream = require('../models/LiveStream');
const User = require('../models/User');
const notificationUtils = require('../lib/notification.js');
const verifyToken = require('../middleware/Verifytoken');
const EventEmitter = require('events');

// In-memory event emitter for live chat
const chatEmitter = new EventEmitter();

// Get active live streams (only from following users)
router.get('/active', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('following');
        const following = user?.following || [];
        
        const activeStreams = await LiveStream.find({ 
            status: 'active',
            $or: [
                { host: { $in: following } },
                { host: req.userId }
            ]
        })
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
        const userId = req.userId;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Check if user already has an active stream
        await LiveStream.updateMany({ host: userId, status: 'active' }, { status: 'ended', endTime: Date.now() });

        const stream = new LiveStream({
            host: userId,
            title: req.body.title || `${user.fullname}'s Live Stream`
        });
        await stream.save();
        
        // Notify followers
        const followers = user.followers || [];
        for (const followerId of followers) {
            notificationUtils.createNotification({
                recipientId: followerId,
                sender: { id: userId, fullname: user.fullname, profile_picture: user.profile_picture },
                type: 'system',
                message: { content: `${user.fullname} is currently live!` },
                url: `/stories?user=${userId}`
            }).catch(err => console.error('Live notification failed:', err.message));
        }

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
            { _id: req.params.id, host: req.userId },
            { status: 'ended', endTime: Date.now() },
            { new: true }
        );
        res.json(stream);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── SSE CHAT IMPLEMENTATION ─────────────────────────────────────────────────

// SSE endpoint to listen for chat messages
router.get('/:id/chat/stream', (req, res) => {
    const streamId = req.params.id;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const onMessage = (message) => {
        if (message.streamId === streamId) {
            res.write(`data: ${JSON.stringify(message)}\n\n`);
        }
    };

    chatEmitter.on('message', onMessage);

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 30000);

    req.on('close', () => {
        chatEmitter.removeListener('message', onMessage);
        clearInterval(heartbeat);
        res.end();
    });
});

// POST endpoint to send a chat message
router.post('/:id/chat/message', verifyToken, async (req, res) => {
    try {
        const streamId = req.params.id;
        const { text } = req.body;
        
        const user = await User.findById(req.userId).select('fullname profile_picture');
        if (!user) return res.status(404).json({ error: 'User not found' });

        const message = {
            id: Date.now(),
            streamId,
            text,
            user: {
                id: user._id,
                fullname: user.fullname,
                profile_picture: user.profile_picture
            },
            timestamp: new Date()
        };

        chatEmitter.emit('message', message);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
