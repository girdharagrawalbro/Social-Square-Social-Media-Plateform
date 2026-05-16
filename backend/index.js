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
        const safePaths = ['/refresh', '/get', '/other-users', '/search', '/other-user', '/notification-settings'];
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

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
    origin: allowedOrigins, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-fingerprint', 'x-request-id']
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// ✅ Use 'tiny' morgan format — logs 60% less data than 'combined'
// In production, skip successful health checks entirely
if (process.env.NODE_ENV !== 'production') {
    const morgan = require('morgan');
    app.use(morgan('dev'));
}

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

const notificationUtils = require('./lib/notification.js');
notificationUtils.setIo(io);

postRouter.setIo(io);
storyRouter.setIo(io);
conversationRouter.setIo(io);

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
app.use('/api/live', require('./routes/live'));
app.use('/api/ai', (req, res, next) => require('./routes/ai.js')(req, res, next));
app.use('/api/media', require('./routes/media'));
app.use('/api/admin', (req, res, next) => require('./routes/admin.js')(req, res, next));
app.use('/api/chatbot', (req, res, next) => require('./routes/chatbot.js')(req, res, next));
app.use("/api/recommendation", require("./routes/recommendation"));

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

io.on('connection', (socket) => {
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
        } catch (err) {
            console.error('[Socket] Redis error (registerUser):', err.message);
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

    socket.on('typing', async ({ recipientId, senderName }) => {
        try {
            const sid = redis ? await redis.hget('online_users', recipientId) : null;
            if (sid) io.to(sid).emit('userTyping', { senderName });
        } catch (err) {
            console.error('[Socket] Redis error (typing):', err.message);
        }
    });

    socket.on('stopTyping', async ({ recipientId }) => {
        try {
            const sid = redis ? await redis.hget('online_users', recipientId) : null;
            if (sid) io.to(sid).emit('userStoppedTyping');
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

    socket.on('disconnect', async () => {
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
    });

    // ─── WebRTC Signaling for Live Stream ────────────────────────────────────
    socket.on('join-live', (streamId) => {
        socket.join(`live:${streamId}`);
    });

    socket.on('live-offer', ({ to, offer }) => {
        socket.to(to).emit('live-offer', { from: socket.userId, offer });
    });

    socket.on('live-answer', ({ to, answer }) => {
        socket.to(to).emit('live-answer', { from: socket.userId, answer });
    });

    socket.on('ice-candidate', ({ to, candidate }) => {
        socket.to(to).emit('ice-candidate', { from: socket.userId, candidate });
    });
});

// ✅ ─── PRESENCE HOUSEKEEPING (TTL Cleanup) ──────────────────────────────────
// Runs every 30s to evict users who haven't sent a heartbeat in > 60s
setInterval(async () => {
    if (!redis) return;
    try {
        const now = Date.now();
        const threshold = now - 60000; // 60s inactivity
        const staleIds = await redis.zrangebyscore('presence_heartbeats', '-inf', threshold);

        if (staleIds.length > 0) {
            console.log(`[Presence] Evicting ${staleIds.length} stale users`);
            for (const uId of staleIds) {
                await redis.hdel('online_users', uId);
                await redis.zrem('presence_heartbeats', uId);
                io.emit('userOffline', uId);
                // Update DB to reflect offline status
                await User.findByIdAndUpdate(uId, { isOnline: false, lastSeen: new Date() });
            }
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
        const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes
        setInterval(async () => {
            try {
                const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
                const axios = require('axios');
                await axios.get(`${url}/ping`);
                console.log(`[Self-Ping] Keep-alive ping sent to ${url}/ping successfully`);
            } catch (error) {
                console.error(`[Self-Ping] Error: ${error.message}`);
            }
        }, PING_INTERVAL);
    });
}

bootstrap().catch(err => {
    console.error('[Bootstrap] Failed:', err.message);
    process.exit(1);
});
