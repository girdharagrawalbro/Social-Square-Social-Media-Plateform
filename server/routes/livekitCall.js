const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/Verifytoken');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
};

// POST /api/conversation/call/token - Generate access token for call room
router.post('/token', verifyToken, [
    body('conversationId').isMongoId().withMessage('Invalid conversation ID'),
    validate
], async (req, res) => {
    try {
        const { conversationId } = req.body;
        const userId = req.userId;

        // Verify that the user is a participant of this conversation
        const conv = await Conversation.findOne({ _id: conversationId, 'participants.userId': userId }).lean();
        if (!conv) {
            return res.status(403).json({ error: 'Unauthorized. You are not a participant of this chat.' });
        }

        const user = await User.findById(userId).select('fullname username');
        if (!user) return res.status(404).json({ error: 'User not found' });

        const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
        const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';
        const livekitHttpUrl = (process.env.LIVEKIT_URL || 'https://localhost:7880').replace(/^wss?:\/\//, 'https://');

        const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');

        // Pre-create the room with 1-on-1 call optimized settings:
        // emptyTimeout: 60 seconds (destroy room quickly if they leave)
        // maxParticipants: 2 (1-on-1 calls)
        const roomService = new RoomServiceClient(livekitHttpUrl, apiKey, apiSecret);
        try {
            await roomService.createRoom({
                name: conversationId,
                emptyTimeout: 60,
                maxParticipants: 2,
            });
            console.log('[LiveKit Call] Room ensured:', conversationId);
        } catch (roomErr) {
            console.log('[LiveKit Call] Room already exists or ensured (safe to ignore):', roomErr.message);
        }

        const at = new AccessToken(apiKey, apiSecret, {
            identity: user.username || userId,
            name: user.fullname,
            ttl: '2h', // Call tokens are valid for 2 hours
        });

        at.addGrant({
            room: conversationId,
            roomJoin: true,
            canPublish: true, // Both caller and receiver can publish audio/video tracks
            canPublishData: true,
            canSubscribe: true
        });

        const token = await at.toJwt();
        res.json({ token, conversationId });
    } catch (error) {
        console.error('[LiveKit Call Token Error]:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;