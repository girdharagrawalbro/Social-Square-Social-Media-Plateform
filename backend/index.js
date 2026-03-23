require('dotenv').config();
const cluster = require('cluster');
const os = require('os');

// ─── CLUSTER MODE ─────────────────────────────────────────────────────────────
if (cluster.isPrimary && process.env.NODE_ENV === 'production') {
    const numCPUs = os.cpus().length;
    console.log(`[Cluster] Primary ${process.pid} — forking ${numCPUs} workers`);
    for (let i = 0; i < numCPUs; i++) cluster.fork();
    cluster.on('exit', (worker, code) => {
        console.warn(`[Cluster] Worker ${worker.process.pid} died (code ${code}) — restarting`);
        cluster.fork();
    });
    return;
}

const connectToMongo = require('./db.js');
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const morgan = require('morgan');
const logger = require('./utils/logger');

const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { initPubSub } = require('./lib/pubsub');
const { initPostSubscriber, setIo: setSubscriberIo } = require('./subscribers/postSubscriber');
const postRouter = require('./routes/post.js');
const storyRouter = require('./routes/story.js');

connectToMongo();

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;

// ─── SECURITY ─────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));

// ✅ Gzip compress all responses — reduces payload ~70%
app.use(compression({ level: 6, threshold: 1024 }));

app.use(cookieParser());

// ─── RATE LIMITING ────────────────────────────────────────────────────────────
// ─── RATE LIMITERS ────────────────────────────────────────────────────────────
// Strategy: tight limits only on sensitive write endpoints
// NOT on read endpoints or token refresh (would cause logout loops)

// Sensitive auth actions: login, signup, password reset ONLY
const authWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Try again in 15 minutes.' },
    // ✅ Skip read endpoints and token refresh — they are NOT brute-force targets
    skip: (req) => {
        const safePaths = ['/refresh', '/get', '/other-users', '/search', '/other-user', '/notification-settings'];
        return safePaths.some(p => req.path.includes(p));
    },
});

// General API — generous limit, per IP
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,  // 1 minute
    max: 500,             // 500 req/min per IP — enough for normal usage + polling
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Slow down.' },
    skip: (req) => {
        // Skip admin routes (admins need higher limits)
        // Skip socket.io polling (has its own rate limiting)
        return req.path.startsWith('/admin') || req.path.startsWith('/socket.io');
    },
});

// Report abuse — strict, per IP
const reportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: { error: 'Too many reports submitted.' },
});

// ✅ Apply limiters to specific paths ONLY — no stacking
app.use('/api/auth', authWriteLimiter); // only on auth write actions
app.use('/api/admin/report', reportLimiter);
app.use('/api', apiLimiter);       // general fallback

// ─── ALLOWED ORIGINS ──────────────────────────────────────────────────────────
const allowedOrigins = [
    'http://localhost:3000',
    'https://social-square-social-media-platefor.vercel.app',
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
];

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────
const io = socketIo(server, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 1e6,
});

// ─── REDIS ADAPTER ────────────────────────────────────────────────────────────
(async () => {
    try {
        const { createClient } = require('redis');
        const { createAdapter } = require('@socket.io/redis-adapter');
        const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
        
        // Register error handlers before connecting to prevent unhandled exceptions
        pubClient.on('error', (err) => logger.error('[Redis Pub] Error: %s', err.message));
        
        const subClient = pubClient.duplicate();
        subClient.on('error', (err) => logger.error('[Redis Sub] Error: %s', err.message));

        await Promise.all([pubClient.connect(), subClient.connect()]);
        io.adapter(createAdapter(pubClient, subClient));
        logger.info('[Redis] Socket.io adapter configured');
    } catch (err) {
        logger.warn('[Redis] Not configured: %s', err.message);
    }
})();

// ─── PUB/SUB (Redis) ──────────────────────────────────────────────────────────
(async () => {
    try {
        await initPubSub();
        setSubscriberIo(io);
        postRouter.setIo(io);
        storyRouter.setIo(io);
        await initPostSubscriber();
        logger.info('[PubSub] Subscribers initialized via Redis');
    } catch (err) {
        logger.warn('[PubSub] Initialization failed: %s', err.message);
    }
})();

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(morgan('combined', { stream: logger.stream }));
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({ status: 'ok', pid: process.pid, uptime: Math.floor(process.uptime()), memory: process.memoryUsage().heapUsed });
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth.js'));
app.use('/api/post', postRouter);
app.use('/api/conversation', require('./routes/conversation.js'));
app.use('/api/story', storyRouter);
app.use('/api/ai', require('./routes/ai.js'));
app.use('/api/admin', require('./routes/admin.js'));
app.use('/api/chatbot', require('./routes/chatbot.js'));

// ─── ERROR HANDLERS ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    logger.error('[Error] %s', err.stack);
    res.status(err.status || 500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
});
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// ─── SOCKET.IO EVENTS ─────────────────────────────────────────────────────────
// Map is O(1) lookup vs Array O(n) — critical at 100k+ concurrent users
const onlineUsers = new Map();

const getOnlineList = () => [...onlineUsers.entries()].map(([userId, socketId]) => ({ userId, socketId }));

io.on('connection', (socket) => {
    socket.on('registerUser', (userId) => {
        socket.join(userId);
        onlineUsers.set(userId, socket.id);
        io.emit('updateUserList', getOnlineList());
    });

    socket.on('logoutUser', (userId) => {
        onlineUsers.delete(userId);
        io.emit('updateUserList', getOnlineList());
    });

    socket.on('sendMessage', ({ recipientId, content, senderName, sender, conversationId, _id, createdAt, isRead }) => {
        const recipientSocketId = onlineUsers.get(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('receiveMessage', { senderId: sender, socketId: socket.id, content, recipientId, senderName, conversationId, _id, createdAt, isRead });
        }
    });

    socket.on('typing', ({ recipientId, senderName }) => {
        const sid = onlineUsers.get(recipientId);
        if (sid) io.to(sid).emit('userTyping', { senderName });
    });

    socket.on('stopTyping', ({ recipientId }) => {
        const sid = onlineUsers.get(recipientId);
        if (sid) io.to(sid).emit('userStoppedTyping');
    });

    socket.on('readMessage', ({ messageId, socketId }) => {
        io.to(socketId).emit('seenMessage', { messageId });
    });

    socket.on('collaborationResponse', ({ postId, userId, accepted }) => {
        io.emit('collaborationUpdate', { postId, userId, accepted });
    });

    // ─── Chat action forwarding ───────────────────────────────────────────────
    // Client emits these after API call — server forwards to recipient's room
    socket.on('messageEdited', ({ messageId, content, conversationId, recipientId }) => {
        if (recipientId) {
            io.to(recipientId).emit('messageEdited', { messageId, content, conversationId });
        }
    });

    socket.on('messageDeleted', ({ messageId, conversationId, recipientId }) => {
        if (recipientId) {
            io.to(recipientId).emit('messageDeleted', { messageId, conversationId });
        }
    });

    socket.on('messageReaction', ({ messageId, conversationId, reactions, recipientId }) => {
        if (recipientId) {
            io.to(recipientId).emit('messageReaction', { messageId, conversationId, reactions });
        }
    });

    socket.on('disconnect', () => {
        for (const [userId, socketId] of onlineUsers.entries()) {
            if (socketId === socket.id) { onlineUsers.delete(userId); break; }
        }
        io.emit('updateUserList', getOnlineList());
    });
});

// ─── GRACEFUL SHUTDOWN ────────────────────────────────────────────────────────
const gracefulShutdown = (signal) => {
    logger.info(`[${signal}] Graceful shutdown`);
    server.close(async () => {
        try { const mongoose = require('mongoose'); await mongoose.connection.close(); } catch { }
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ─── START ────────────────────────────────────────────────────────────────────
server.listen(port, () => logger.info(`[Worker ${process.pid}] Running on port ${port}`));