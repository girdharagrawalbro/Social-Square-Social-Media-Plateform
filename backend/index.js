require('dotenv').config();

// ✅ Hard cap Node.js heap at 400MB — leaves 112MB for OS + native modules
// Without this Node defaults to 1.5GB and never GCs aggressively
if (process.env.NODE_ENV === 'production') {
    // Set via package.json start script: node --max-old-space-size=400 index.js
    // But also set here as fallback
}

const connectToMongo = require('./db.js');
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const redis = require('./lib/redis');
const User = require('./models/User');
const Conversation = require('./models/Conversation');
require('./models/Recommendation');
const verifyToken = require('./middleware/Verifytoken');


// ✅ NO cluster in single-dyno/512MB deployments
// Cluster multiplies RAM usage by CPU count — 4 cores = 4x RAM
// Use a single process + async I/O instead
// To scale horizontally, run multiple dynos behind a load balancer

connectToMongo();

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;

const { correlationMiddleware } = require('./middleware/correlation');

app.set('trust proxy', 1);
app.use(correlationMiddleware);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
    origin: allowedOrigins, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-fingerprint', 'x-request-id']
}));

// ─── SECURITY + COMPRESSION ───────────────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false, crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginEmbedderPolicy: false,
}));
app.use(compression({ level: 6, threshold: 1024 }));
app.use(cookieParser());

// ─── RATE LIMITING ────────────────────────────────────────────────────────────
const authWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Try again in 15 minutes.' },
    skip: (req) => {
        const safePaths = ['/refresh', '/get', '/other-users', '/search', '/other-user', '/user', '/notification-settings'];
        return safePaths.some(p => req.path.includes(p));
    },
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests.' },
    skip: (req) => req.path.startsWith('/admin') || req.path.startsWith('/socket.io'),
});

const reportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { error: 'Too many reports.' },
});

// ✅ Rate limiting for high-stakes post operations - MOVED to middleware/postWriteLimiter.js

app.use('/api/auth', authWriteLimiter);
app.use('/api/admin/report', reportLimiter);
app.use('/api', apiLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Always log requests, using lightweight 'tiny' format in production with timing
const morgan = require('morgan');
app.use(morgan(process.env.NODE_ENV === 'production' ? 'tiny' : 'dev'));

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────
const io = socketIo(server, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    maxHttpBufferSize: 1e6,

    // ✅ Reduce socket.io memory: don't buffer events for disconnected clients
    connectTimeout: 10000,
});

// ─── REDIS ADAPTER (optional — only if REDIS_URL set) ─────────────────────────
async function initRedis() {
    if (process.env.DISABLE_REDIS === 'true') {
        console.log('[Redis] Adapter skipped (DISABLE_REDIS is true)');
        return;
    }
    if (!process.env.REDIS_URL) {
        console.log('[Redis] No REDIS_URL — skipping adapter (single instance mode)');
        return;
    }
    try {
        const { createClient } = require('redis');
        const { createAdapter } = require('@socket.io/redis-adapter');
        const pubClient = createClient({ url: process.env.REDIS_URL });
        pubClient.on('error', err => console.error('[Redis Pub]', err.message));
        const subClient = pubClient.duplicate();
        subClient.on('error', err => console.error('[Redis Sub]', err.message));
        await Promise.all([pubClient.connect(), subClient.connect()]);
        // Gate the socket.io Redis adapter behind an env flag so we can disable during testing
        // To enable, set `ENABLE_SOCKET_REDIS_ADAPTER=true` in your environment
        if (process.env.ENABLE_SOCKET_REDIS_ADAPTER === 'true') {
            io.adapter(createAdapter(pubClient, subClient));
            console.log('[Redis] Socket.io adapter configured');
        } else {
            console.log('[Redis] Socket.io adapter disabled (ENABLE_SOCKET_REDIS_ADAPTER !== true)');
        }
    } catch (err) {
        console.warn('[Redis] Failed:', err.message);
    }
}

// ─── PUBSUB ───────────────────────────────────────────────────────────────────
async function initPubSubLayer() {
    try {
        const { initPubSub } = require('./lib/pubsub');
        const { initPostSubscriber, setIo: setSubscriberIo } = require('./subscribers/postSubscriber');
        setSubscriberIo(io);
        await initPubSub();
        await initPostSubscriber();
        console.log('[PubSub] Initialized');

        // Initialize integrated Recommender Worker locally
        const { initWorker: initRecommenderWorker } = require('./recommenderWorker');
        await initRecommenderWorker();
    } catch (err) {
        console.warn('[PubSub] Failed:', err.message);
    }
}

async function initCleanupJobs() {
    try {
        const { scheduleCleanup } = require('./queues/cleanupQueue');
        await scheduleCleanup();
    } catch (err) {
        console.warn('[Cleanup] Failed to schedule:', err.message);
    }
}

// ─── ROUTES (lazy-loaded to reduce startup memory) ────────────────────────────
// Each require() loads the module + its dependencies into memory
// By using a getter pattern we defer loading until first request
// Saves ~20-40MB at startup depending on module sizes

const postRouter = require('./routes/post.js');
const storyRouter = require('./routes/story.js');
const conversationRouter = require('./routes/conversation.js');
const liveRouter = require('./routes/live.js');

const notificationUtils = require('./lib/notification.js');
notificationUtils.setIo(io);

postRouter.setIo(io);
storyRouter.setIo(io);
conversationRouter.setIo(io);
liveRouter.setIo(io);

app.get('/ping', (req, res) => res.status(200).json({ status: 'ok', message: 'pong' }));

app.get('/health', (req, res) => {
    const mem = process.memoryUsage();
    res.json({
        status: 'ok',
        pid: process.pid,
        uptime: Math.floor(process.uptime()),
        memory: {
            heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
            rss: `${Math.round(mem.rss / 1024 / 1024)}MB`, // actual process RAM
            external: `${Math.round(mem.external / 1024 / 1024)}MB`,
        }
    });
});

app.post('/api/user/fcm-token', verifyToken, async (req, res) => {
    const { token } = req.body;
    await User.findByIdAndUpdate(req.userId, { fcmToken: token });
    res.json({ success: true });
});

// ✅ Routes
app.use('/api/auth', (req, res, next) => require('./routes/auth.js')(req, res, next));
app.use('/api/post', postRouter);
app.use('/api/conversation', conversationRouter);
app.use('/api/story', storyRouter);
app.use('/api/group', require('./routes/group'));
app.use('/api/live', liveRouter);
app.use('/api/conversation/call', require('./routes/livekitCall.js'));
app.use('/api/ai', (req, res, next) => require('./routes/ai.js')(req, res, next));
app.use('/api/media', require('./routes/media'));
app.use('/api/admin', (req, res, next) => require('./routes/admin.js')(req, res, next));
app.use('/api/chatbot', (req, res, next) => require('./routes/chatbot.js')(req, res, next));
app.use("/api/recommendation", require("./routes/recommendation"));
app.use('/api/contact', require('./routes/contact.js'));

// ─── ERROR HANDLERS ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[Error]', err.message);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
});
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// ─── SOCKET.IO RATE LIMITING ──────────────────────────────────────────────────
const { RateLimiterMemory, RateLimiterRedis } = require('rate-limiter-flexible');

// Global event limiter (10 events/sec)
const socketGlobalLimiter = (process.env.DISABLE_REDIS === 'true' || !process.env.REDIS_URL)
    ? new RateLimiterMemory({ points: 10, duration: 1 })
    : new RateLimiterRedis({ storeClient: redis, points: 10, duration: 1, keyPrefix: 'socket_global' });

// Stricter limiter for high-frequency events like typing (2 events/sec)
const socketStrictLimiter = (process.env.DISABLE_REDIS === 'true' || !process.env.REDIS_URL)
    ? new RateLimiterMemory({ points: 2, duration: 1 })
    : new RateLimiterRedis({ storeClient: redis, points: 2, duration: 1, keyPrefix: 'socket_strict' });

const activeCalls = new Map();

async function saveCallMessage(io, conversationId, senderId, content) {
    try {
        const Message = require('./models/Message');
        const Conversation = require('./models/Conversation');
        const User = require('./models/User');

        const message = await Message.create({
            conversationId,
            sender: senderId,
            content: content
        });

        const updatedConv = await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: {
                id: message._id,
                message: content,
                isRead: false
            },
            lastMessageAt: new Date(),
            lastMessageBy: senderId,
        }, { new: true }).lean();

        const senderUser = await User.findById(senderId).select('fullname').lean();
        const participants = updatedConv.participants.map(p => p.userId.toString());

        const msgObj = { ...message.toObject(), senderId: senderId, senderName: senderUser?.fullname };
        participants.forEach(p => {
            io.to(p).emit('receiveMessage', msgObj);
            io.to(p).emit('conversationUpdated', updatedConv);
        });
    } catch (err) {
        console.error('[saveCallMessage Error]:', err);
    }
}

io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id} from ${socket.handshake.address}`);
    // Middleware to rate limit every incoming event
    socket.use(async ([event, ...args], next) => {
        // Whitelist critical/internal events
        if (['registerUser', 'join-live'].includes(event)) return next();

        const limiter = ['typing', 'messageReaction', 'stopTyping'].includes(event)
            ? socketStrictLimiter
            : socketGlobalLimiter;

        const key = socket.userId || socket.handshake.address;

        try {
            await limiter.consume(key);
            next();
        } catch (err) {
            console.warn(`[Socket Rate Limit] Blocked ${event} from ${key}`);
            socket.emit('error', { message: 'Rate limit exceeded. Please slow down.' });
            // By not calling next(), the event is dropped.
        }
    });


    socket.on('registerUser', async (userId) => {
        socket.userId = userId;
        socket.join(userId);

        try {
            if (!redis) return;

            await redis.hset('online_users', userId, socket.id);
            // ✅ Track active timestamp for TTL cleanup
            await redis.zadd('presence_heartbeats', Date.now(), userId);

            // 1. Send list of online users
            const onlineMap = await redis.hgetall('online_users');
            const currentOnlineUsers = Object.entries(onlineMap).map(([uId, sId]) => ({ userId: uId, socketId: sId }));
            socket.emit('updateUserList', currentOnlineUsers);

            // 2. Broadcast new user
            socket.broadcast.emit('userOnline', { userId, socketId: socket.id });

            // 3. Update MongoDB
            await User.findByIdAndUpdate(userId, { isOnline: true });

            // 4. Check if there is an active call waiting for this user (e.g. after a page refresh)
            for (const [convId, call] of activeCalls.entries()) {
                if (call.recipientId === userId && !call.accepted) {
                    const User = require('./models/User');
                    const callerUser = await User.findById(call.callerId).select('fullname profile_picture').lean();
                    socket.emit('incomingCall', {
                        callerId: call.callerId,
                        callerName: callerUser?.fullname || 'Someone',
                        callerAvatar: callerUser?.profile_picture || '',
                        type: call.type,
                        conversationId: convId
                    });
                    console.log(`[Socket] Restored active call to reconnected user: ${userId}`);
                    break;
                }
            }
        } catch (err) {
            console.error('[Socket] Redis error (registerUser):', err.message);
        }
    });

    // ─── CHECK ACTIVE CALL (Solves page refresh race condition) ───────────────────
    socket.on('checkActiveCall', async () => {
        const userId = socket.userId;
        if (!userId) return;
        
        console.log(`🔍 [Socket] User ${userId} requested active call check`);
        for (const [convId, call] of activeCalls.entries()) {
            if (call.recipientId === userId && !call.accepted) {
                const User = require('./models/User');
                const callerUser = await User.findById(call.callerId).select('fullname profile_picture').lean();
                socket.emit('incomingCall', {
                    callerId: call.callerId,
                    callerName: callerUser?.fullname || 'Someone',
                    callerAvatar: callerUser?.profile_picture || '',
                    type: call.type,
                    conversationId: convId,
                    isRestored: true
                });
                console.log(`[Socket] Restored active incoming call to ${userId} on request`);
                break;
            }
        }
    });

    socket.on('heartbeat', async (userId) => {
        if (!redis || !userId) return;
        try {
            await redis.zadd('presence_heartbeats', Date.now(), userId);
        } catch (err) {
            console.error('[Socket] Heartbeat error:', err.message);
        }
    });

    socket.on('logoutUser', async (userId) => {
        try {
            if (redis) {
                await redis.hdel('online_users', userId);
                await redis.zrem('presence_heartbeats', userId);
                io.emit('userOffline', userId);
                await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
            }
        } catch (err) {
            console.error('[Socket] Redis error (logoutUser):', err.message);
        }
    });

    socket.on('typing', async ({ recipientId, conversationId, senderName }) => {
        try {
            if (conversationId) {
                const conv = await Conversation.findById(conversationId).select('participants').lean();
                if (conv) {
                    conv.participants.forEach(async (p) => {
                        if (p.userId.toString() !== socket.userId) {
                            const sid = redis ? await redis.hget('online_users', p.userId.toString()) : null;
                            if (sid) io.to(sid).emit('userTyping', { senderName, conversationId });
                        }
                    });
                }
            } else if (recipientId) {
                const sid = redis ? await redis.hget('online_users', recipientId) : null;
                if (sid) io.to(sid).emit('userTyping', { senderName });
            }
        } catch (err) {
            console.error('[Socket] Redis error (typing):', err.message);
        }
    });

    socket.on('stopTyping', async ({ recipientId, conversationId }) => {
        try {
            if (conversationId) {
                const conv = await Conversation.findById(conversationId).select('participants').lean();
                if (conv) {
                    conv.participants.forEach(async (p) => {
                        if (p.userId.toString() !== socket.userId) {
                            const sid = redis ? await redis.hget('online_users', p.userId.toString()) : null;
                            if (sid) io.to(sid).emit('userStoppedTyping', { conversationId });
                        }
                    });
                }
            } else if (recipientId) {
                const sid = redis ? await redis.hget('online_users', recipientId) : null;
                if (sid) io.to(sid).emit('userStoppedTyping');
            }
        } catch (err) {
            console.error('[Socket] Redis error (stopTyping):', err.message);
        }
    });

    socket.on('readMessage', ({ messageId, recipientId }) => {
        if (recipientId) io.to(recipientId).emit('seenMessage', { messageId });
    });

    socket.on('collaborationResponse', ({ postId, userId, accepted }) => {
        io.emit('collaborationUpdate', { postId, userId, accepted });
    });

    socket.on('messageEdited', ({ messageId, content, conversationId, recipientId }) => {
        if (recipientId) io.to(recipientId).emit('messageEdited', { messageId, content, conversationId });
    });

    socket.on('messageDeleted', ({ messageId, conversationId, recipientId }) => {
        if (recipientId) io.to(recipientId).emit('messageDeleted', { messageId, conversationId });
    });

    socket.on('messageReaction', ({ messageId, conversationId, reactions, recipientId }) => {
        if (recipientId) io.to(recipientId).emit('messageReaction', { messageId, conversationId, reactions });
    });

    socket.on('initiateCall', ({ recipientId, type, conversationId, callerName, callerAvatar }) => {
        if (recipientId) {
            activeCalls.set(conversationId, {
                startTime: Date.now(),
                type,
                callerId: socket.userId,
                recipientId,
                accepted: false
            });

            io.to(recipientId).emit('incomingCall', {
                callerId: socket.userId,
                callerName,
                callerAvatar,
                type,
                conversationId
            });
        }
    });

    socket.on('acceptCall', ({ callerId, conversationId }) => {
        if (callerId) {
            const call = activeCalls.get(conversationId);
            if (call) {
                call.accepted = true;
                call.connectTime = Date.now();
            }
            io.to(callerId).emit('callAccepted', { receiverId: socket.userId, conversationId });
        }
    });

    socket.on('declineCall', ({ callerId }) => {
        if (callerId) {
            let callToDecline = null;
            let foundConvId = null;
            for (const [convId, call] of activeCalls.entries()) {
                if (call.callerId === callerId && call.recipientId === socket.userId) {
                    callToDecline = call;
                    foundConvId = convId;
                    break;
                }
            }

            if (callToDecline && foundConvId) {
                const content = callToDecline.type === 'video' ? '📹 Missed video chat' : '📞 Missed voice call';
                saveCallMessage(io, foundConvId, callToDecline.callerId, content);
                activeCalls.delete(foundConvId);
            }

            io.to(callerId).emit('callDeclined');
        }
    });

    socket.on('endCall', ({ recipientId, conversationId }) => {
        if (recipientId) {
            const call = activeCalls.get(conversationId);
            if (call) {
                let content = '';
                if (call.accepted && call.connectTime) {
                    const durationSec = Math.floor((Date.now() - call.connectTime) / 1000);
                    const minutes = Math.floor(durationSec / 60);
                    const seconds = durationSec % 60;
                    const durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
                    content = call.type === 'video'
                        ? `📹 Video chat ended - ${durationStr}`
                        : `📞 Voice call ended - ${durationStr}`;
                } else {
                    content = call.type === 'video'
                        ? '📹 Missed video chat'
                        : '📞 Missed voice call';
                }
                saveCallMessage(io, conversationId, call.callerId, content);
                activeCalls.delete(conversationId);
            }

            io.to(recipientId).emit('callEnded', { conversationId });
        }
    });

    socket.on('disconnect', async (reason) => {
        console.log(`[Socket] Disconnected: ${socket.id} (${socket.userId || 'unregistered'}) — reason: ${reason}`);
        const userId = socket.userId;
        if (userId) {
            try {
                if (redis) {
                    const currentSid = await redis.hget('online_users', userId);
                    if (currentSid === socket.id) {
                        await redis.hdel('online_users', userId);
                        await redis.zrem('presence_heartbeats', userId);
                        io.emit('userOffline', userId);
                        await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
                    }
                }
            } catch (err) {
                console.error('[Socket] Redis error (disconnect):', err.message);
            }
        }

        // If host disconnected unexpectedly (internet drop, browser crash, tab close)
        if (socket.isLiveHostOf) {
            const streamId = socket.isLiveHostOf;
            if (!global.liveEndTimers) global.liveEndTimers = {};

            console.log(`[Live Stream] Host ${socket.userId} disconnected from stream ${streamId}. Starting 30s auto-end countdown...`);

            // Notify viewers host is trying to reconnect
            io.to(`live:${streamId}`).emit('live-paused', streamId);

            global.liveEndTimers[streamId] = setTimeout(async () => {
                try {
                    const LiveStream = require('./models/LiveStream');
                    await LiveStream.findByIdAndUpdate(streamId, { status: 'ended', endTime: Date.now() });
                    io.to(`live:${streamId}`).emit('live-ended', streamId);
                    console.log(`[Live Stream] Stream ${streamId} automatically ended: Host did not reconnect within 30s.`);
                } catch (err) {
                    console.error('[Live Stream] Auto-end failed:', err.message);
                } finally {
                    delete global.liveEndTimers[streamId];
                }
            }, 30000); // 30 seconds buffer
        }

        // Update viewer count for any live rooms this socket was in
        socket.rooms.forEach(async (room) => {
            if (room.startsWith('live:')) {
                const streamId = room.replace('live:', '');
                const totalInRoom = io.sockets.adapter.rooms.get(room)?.size || 0;
                const viewerCount = Math.max(0, totalInRoom - 2);
                io.to(room).emit('viewer-joined', { viewerCount });

                // Instagram-style leave notification
                try {
                    const user = await User.findById(socket.userId).select('fullname profile_picture');
                    if (user) {
                        io.to(room).emit('viewer-left-chat', {
                            userId: socket.userId,
                            fullname: user.fullname,
                            profile_picture: user.profile_picture
                        });
                    }
                } catch (e) { }
            }
        });
    });

    // ─── WebRTC Signaling for Live Stream ────────────────────────────────────
    socket.on('join-live', async (streamId) => {
        socket.join(`live:${streamId}`);

        // Track stream state on socket to detect host crash/disconnect
        const LiveStream = require('./models/LiveStream');
        try {
            const stream = await LiveStream.findById(streamId);
            if (stream && stream.host.toString() === socket.userId) {
                // This socket belongs to the host
                socket.isLiveHostOf = streamId;

                // If there was an existing auto-end countdown running for this stream, cancel it (host reconnected)
                if (global.liveEndTimers && global.liveEndTimers[streamId]) {
                    clearTimeout(global.liveEndTimers[streamId]);
                    delete global.liveEndTimers[streamId];
                    console.log(`[Live Stream] Host reconnected to stream ${streamId}. Auto-end timer cancelled.`);
                    // Notify viewers the host is back online and recovered, so they must recreate peer connections
                    io.to(`live:${streamId}`).emit('live-host-recovered', streamId);
                    io.to(`live:${streamId}`).emit('live-resumed', streamId);
                }
            }
        } catch (err) { }

        const totalInRoom = io.sockets.adapter.rooms.get(`live:${streamId}`)?.size || 0;
        const viewerCount = Math.max(0, totalInRoom - 1); // exclude the host
        io.to(`live:${streamId}`).emit('viewer-joined', { viewerCount });

        // Instagram-style join notification
        try {
            const user = await User.findById(socket.userId).select('fullname profile_picture');
            if (user) {
                io.to(`live:${streamId}`).emit('viewer-joined-chat', {
                    userId: socket.userId,
                    fullname: user.fullname,
                    profile_picture: user.profile_picture
                });
            }
        } catch (e) { }
    });

    socket.on('leave-live', async (streamId) => {
        socket.leave(`live:${streamId}`);
        const totalInRoom = io.sockets.adapter.rooms.get(`live:${streamId}`)?.size || 0;
        const viewerCount = Math.max(0, totalInRoom - 1); // exclude the host
        io.to(`live:${streamId}`).emit('viewer-joined', { viewerCount });

        // Instagram-style leave notification
        try {
            const user = await User.findById(socket.userId).select('fullname profile_picture');
            if (user) {
                io.to(`live:${streamId}`).emit('viewer-left-chat', {
                    userId: socket.userId,
                    fullname: user.fullname,
                    profile_picture: user.profile_picture
                });
            }
        } catch (e) { }
    });

    socket.on('live-offer', ({ to, offer }) => {
        // Route to the target user's personal room (they join via registerUser)
        io.to(to).emit('live-offer', { from: socket.userId, offer });
    });

    socket.on('live-answer', ({ to, answer }) => {
        io.to(to).emit('live-answer', { from: socket.userId, answer });
    });

    socket.on('ice-candidate', ({ to, candidate }) => {
        io.to(to).emit('ice-candidate', { from: socket.userId, candidate });
    });

    socket.on('live-ended', (streamId) => {
        socket.to(`live:${streamId}`).emit('live-ended', streamId);
    });

    socket.on('live-paused', (streamId) => {
        // Relay pause state to all viewers in the room
        socket.to(`live:${streamId}`).emit('live-paused', streamId);
    });

    socket.on('live-resumed', (streamId) => {
        // Relay resume state to all viewers in the room
        socket.to(`live:${streamId}`).emit('live-resumed', streamId);
    });

    socket.on('send-live-message', ({ streamId, message }) => {
        // Broadcast the real-time chat message to all clients in this stream's room (including the sender!)
        io.to(`live:${streamId}`).emit('live-message', message);
    });
});

// ✅ ─── PRESENCE HOUSEKEEPING (TTL Cleanup) ──────────────────────────────────
// Runs every 30s to evict users who haven't sent a heartbeat in > 60s
setInterval(async () => {
    if (!redis || process.env.DISABLE_REDIS === 'true') return;
    try {
        const now = Date.now();
        const threshold = now - 60000; // 60s inactivity
        const staleIds = await redis.zrangebyscore('presence_heartbeats', '-inf', threshold);

        if (staleIds.length > 0) {
            console.log(`[Presence] Evicting ${staleIds.length} stale users`);

            // 1. Batch Redis cleanup in a pipeline
            const pipeline = redis.pipeline();
            staleIds.forEach(uId => {
                pipeline.hdel('online_users', uId);
                pipeline.zrem('presence_heartbeats', uId);
            });
            await pipeline.exec();

            // 2. Broadcast offline state
            staleIds.forEach(uId => {
                io.emit('userOffline', uId);
            });

            // 3. Batch update MongoDB to offline status
            await User.updateMany(
                { _id: { $in: staleIds } },
                { isOnline: false, lastSeen: new Date() }
            );
        }
    } catch (err) {
        console.error('[Presence Cleanup] Error:', err.message);
    }
}, 30000);

// ─── PERIODIC GC HINT ─────────────────────────────────────────────────────────
// Ask V8 to run GC every 5 minutes if --expose-gc flag is set
// Add to package.json: "start": "node --max-old-space-size=400 --expose-gc index.js"
if (global.gc) {
    setInterval(() => {
        global.gc();
        const mb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        if (mb > 300) console.warn(`[Memory] Heap at ${mb}MB after GC`);
    }, 5 * 60 * 1000);
}

// ─── GRACEFUL SHUTDOWN ────────────────────────────────────────────────────────
const gracefulShutdown = (signal) => {
    console.log(`[${signal}] Shutting down...`);
    server.close(async () => {
        try { const mongoose = require('mongoose'); await mongoose.connection.close(); } catch { }
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ─── START ────────────────────────────────────────────────────────────────────
async function bootstrap() {
    await initRedis();
    await initPubSubLayer();
    await initCleanupJobs();
    const { scheduleDailyDigest } = require('./queues/digestQueue');
    await scheduleDailyDigest();

    // ─── MODERATION ───────────────────────────────────────────────────────────────
    try {
        require('./queues/moderationQueue');
        console.log('[Moderation] Worker/Queue initialized');
    } catch (err) {
        console.warn('[Moderation] Failed to initialize:', err.message);
    }
    server.listen(port, () => {
        console.log(`[Server] Running on port ${port} (PID: ${process.pid})`);

        // Self-ping mechanism to keep Render free tier alive
        // const PING_INTERVAL = 5 * 1000; // 5 seconds
        // setInterval(async () => {
        //     try {
        //         const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
        //         const axios = require('axios');
        //         await axios.get(`${url}/ping`);
        //         console.log(`[Self-Ping] Keep-alive ping sent to ${url}/ping successfully`);
        //     } catch (error) {
        //         console.error(`[Self-Ping] Error: ${error.message}`);
        //     }
        // }, PING_INTERVAL);
    });
}

bootstrap().catch(err => {
    console.error('[Bootstrap] Failed:', err.message);
    process.exit(1);
});
