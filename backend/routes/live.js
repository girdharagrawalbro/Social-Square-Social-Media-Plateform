const express = require('express');
const router = express.Router();
const LiveStream = require('../models/LiveStream');
const User = require('../models/User');
const notificationUtils = require('../lib/notification.js');
const verifyToken = require('../middleware/Verifytoken');
const { body, param, validationResult } = require('express-validator');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
};
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
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Start a live stream
router.post('/start', verifyToken, [
    body('title').optional().trim().escape().isLength({ max: 100 }),
    validate
], async (req, res) => {
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
                type: 'livestream',
                message: { content: `${user.fullname} is currently live!` },
                url: `/stories?user=${userId}`
            }).catch(err => console.error('Live notification failed:', err.message));
        }

        const populated = await stream.populate('host', 'fullname profile_picture');

        // Emit socket event to all clients so they can update their active streams
        if (_io) {
            _io.emit('liveStreamStarted', populated);
        }

        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// End a live stream
router.post('/end/:id', verifyToken, [
    param('id').isMongoId().withMessage('Invalid stream ID'),
    validate
], async (req, res) => {
    try {
        const stream = await LiveStream.findOneAndUpdate(
            { _id: req.params.id, host: req.userId },
            { status: 'ended', endTime: Date.now() },
            { new: true }
        );

        // ── Also terminate the LiveKit room so the cloud session closes cleanly ──
        if (stream) {
            const { RoomServiceClient } = require('livekit-server-sdk');
            // RoomServiceClient uses HTTP/gRPC — convert wss:// → https:// (wss is for WebSocket clients only)
            const httpUrl = (process.env.LIVEKIT_URL || 'https://localhost:7880').replace(/^wss?:\/\//, 'https://');
            const roomService = new RoomServiceClient(
                httpUrl,
                process.env.LIVEKIT_API_KEY || 'devkey',
                process.env.LIVEKIT_API_SECRET || 'secret'
            );
            try {
                await roomService.deleteRoom(req.params.id);
                console.log('[LiveKit] Room deleted on stream end:', req.params.id);
            } catch (err) {
                // Room may already be gone — safe to ignore
                console.warn('[LiveKit] deleteRoom warning (non-fatal):', err.message);
            }
        }

        // Emit socket event so clients can remove it from their active streams
        if (_io) {
            _io.emit('liveStreamEnded', req.params.id);
        }

        res.json(stream);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

const redis = require('../lib/redis');
const LiveChatMessage = require('../models/LiveChatMessage');

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

// GET stream chat history (load from Redis cache first, fallback to MongoDB)
router.get('/:id/chat/history', verifyToken, [
    param('id').isMongoId().withMessage('Invalid stream ID'),
    validate
], async (req, res) => {
    try {
        const streamId = req.params.id;
        const cacheKey = `live:chat:${streamId}`;

        // 1. Try to fetch from Redis hot cache
        if (redis && redis.status !== 'disabled') {
            try {
                const cachedMsgs = await redis.lrange(cacheKey, 0, -1);
                if (cachedMsgs && cachedMsgs.length > 0) {
                    // Redis stores LPUSHed elements, reverse to maintain chronological order
                    const history = cachedMsgs.map(m => JSON.parse(m)).reverse();
                    return res.json(history);
                }
            } catch (err) {
                console.error('[Live Chat] Redis read error:', err.message);
            }
        }

        // 2. Fallback to MongoDB cold archive
        const history = await LiveChatMessage.find({ streamId })
            .sort({ createdAt: -1 })
            .limit(500); // return up to 500 recent messages

        // Format history to match streaming payload structure
        const formattedHistory = history.map(msg => ({
            id: msg._id,
            streamId: msg.streamId.toString(),
            text: msg.text,
            user: msg.user,
            timestamp: msg.timestamp
        })).reverse();

        res.json(formattedHistory);
    } catch (error) {
        console.error('[Live Chat] History fetch error:', error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

let _io;
const setIo = (socketIoInstance) => {
    _io = socketIoInstance;
};

// POST endpoint to send a chat message
router.post('/:id/chat/message', verifyToken, [
    param('id').isMongoId().withMessage('Invalid stream ID'),
    body('text').notEmpty().trim().escape().isLength({ max: 500 }),
    validate
], async (req, res) => {
    try {
        const streamId = req.params.id;
        const { text } = req.body;

        // ─── Redis-based Rate Limiter (Max 1 message per user per 500ms) ──────────
        if (redis && redis.status !== 'disabled') {
            const limitKey = `ratelimit:live:chat:${streamId}:${req.userId}`;
            try {
                const isLimited = await redis.get(limitKey);
                if (isLimited) {
                    return res.status(429).json({ error: 'You are sending messages too fast.' });
                }
                // Set lock flag with 500ms TTL (using px PX millisecond option)
                await redis.set(limitKey, '1', 'PX', 500);
            } catch (err) {
                console.error('[Live Chat] Rate limit error:', err.message);
            }
        }

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

        // ─── Socket handles delivery (NON-BLOCKING/IMMEDIATE via Socket.io Room) ──
        if (_io) {
            _io.to(`live:${streamId}`).emit('live-message', message);
        }

        // Keep chatEmitter as fallback
        chatEmitter.emit('message', message);

        // ─── DB handles persistence (NON-BLOCKING/PARALLEL) ───────────────────────
        (async () => {
            try {
                // 1. Write to Redis (hot cache, keep last 500 messages)
                if (redis && redis.status !== 'disabled') {
                    const cacheKey = `live:chat:${streamId}`;
                    await redis.lpush(cacheKey, JSON.stringify(message));
                    await redis.ltrim(cacheKey, 0, 499); // Keep latest 500
                    await redis.expire(cacheKey, 86400); // 24 hours expiry for live stream chat caches
                }
            } catch (err) {
                console.error('[Live Chat] Redis write failure:', err.message);
            }

            try {
                // 2. Write to MongoDB (cold archive)
                const dbMessage = new LiveChatMessage({
                    streamId,
                    user: {
                        id: user._id,
                        fullname: user.fullname,
                        profile_picture: user.profile_picture
                    },
                    text
                });
                await dbMessage.save();
            } catch (err) {
                console.error('[Live Chat] MongoDB save failure:', err.message);
            }
        })();

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET stream details (for viewers to get host ID)
router.get('/stream/:id', verifyToken, [
    param('id').isMongoId().withMessage('Invalid stream ID'),
    validate
], async (req, res) => {
    try {
        const stream = await LiveStream.findById(req.params.id).populate('host', 'fullname profile_picture');
        if (!stream) return res.status(404).json({ error: 'Stream not found' });
        res.json(stream);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /:id/token - Generates a secure LiveKit room token for the host or viewers
router.post('/:id/token', verifyToken, [
    param('id').isMongoId().withMessage('Invalid stream ID'),
    validate
], async (req, res) => {
    try {
        const streamId = req.params.id;
        const stream = await LiveStream.findById(streamId);
        if (!stream || stream.status === 'ended') {
            return res.status(404).json({ error: 'Live stream not found or already ended' });
        }

        const hostId = stream.host._id ? stream.host._id.toString() : stream.host.toString();
        const isHost = hostId.toString() === req.userId.toString();

        const user = await User.findById(req.userId).select('fullname username');
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Retrieve LiveKit Cloud credentials from env variables
        const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
        const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';
        // RoomServiceClient uses HTTP/gRPC — convert wss:// → https:// (wss is for WebSocket clients only)
        const livekitHttpUrl = (process.env.LIVEKIT_URL || 'https://localhost:7880').replace(/^wss?:\/\//, 'https://');

        const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');

        // ── Pre-create the room with resilient timeout settings ───────────────────
        // emptyTimeout:300  → room stays alive 5 min after the last participant leaves,
        //   preventing session churn from StrictMode unmount/remount cycles.
        // departureTimeout:20 → participant slot is held 20 s on disconnect so the
        //   client can reconnect without being evicted.
        const roomService = new RoomServiceClient(livekitHttpUrl, apiKey, apiSecret);
        try {
            await roomService.createRoom({
                name: streamId,
                emptyTimeout: 300,
                departureTimeout: 20,
                maxParticipants: 2000,
            });
            console.log('[LiveKit] Room ensured:', streamId);
        } catch (roomErr) {
            // createRoom is idempotent — if the room already exists this is safe to ignore
            console.log('[LiveKit] Room already exists (safe to ignore):', roomErr.message);
        }

        // Initialize a token with room permission constraints
        const at = new AccessToken(apiKey, apiSecret, {
            identity: user.username || req.userId,
            name: user.fullname,
            ttl: '6h',  // Token valid for 6 hours — covers long streams
        });

        at.addGrant({
            room: streamId,
            roomJoin: true,
            canPublish: isHost, // Only the host is allowed to publish stream tracks
            canPublishData: true,
            canSubscribe: true
        });

        const token = await at.toJwt();
        res.json({ token, isHost });
    } catch (error) {
        console.error('[LiveKit Token Error]:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
module.exports.setIo = setIo;
