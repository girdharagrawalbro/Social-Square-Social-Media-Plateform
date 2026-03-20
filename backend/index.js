require('dotenv').config();
const cluster = require('cluster');
const os      = require('os');

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

const connectToMongo     = require('./db.js');
const express            = require('express');
const cors               = require('cors');
const http               = require('http');
const socketIo           = require('socket.io');
const helmet             = require('helmet');
const compression        = require('compression');
const rateLimit          = require('express-rate-limit');
const cookieParser       = require('cookie-parser');
const { initNats }       = require('./lib/nats');
const { initPostSubscriber, setIo: setSubscriberIo } = require('./subscribers/postSubscriber');
const postRouter         = require('./routes/post.js');
const storyRouter        = require('./routes/story.js');

connectToMongo();

const app    = express();
const server = http.createServer(app);
const port   = process.env.PORT || 5000;

// ─── SECURITY ─────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));

// ✅ Gzip compress all responses — reduces payload ~70%
app.use(compression({ level: 6, threshold: 1024 }));

app.use(cookieParser());

// ─── RATE LIMITING ────────────────────────────────────────────────────────────
const authLimiter   = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,  message: { error: 'Too many auth attempts.' }, standardHeaders: true, legacyHeaders: false });
const apiLimiter    = rateLimit({ windowMs: 60 * 1000,       max: 200, message: { error: 'Rate limit exceeded.' }, skip: req => req.path.startsWith('/api/admin') });
const reportLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10,  message: { error: 'Too many reports.' } });

app.use('/api/auth',         authLimiter);
app.use('/api/admin/report', reportLimiter);
app.use('/api',              apiLimiter);

// ─── ALLOWED ORIGINS ──────────────────────────────────────────────────────────
const allowedOrigins = [
    'http://localhost:3000',
    'https://social-square-social-media-platefor.vercel.app',
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
];

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────
const io = socketIo(server, {
    cors:              { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
    pingTimeout:       60000,
    pingInterval:      25000,
    transports:        ['websocket', 'polling'],
    maxHttpBufferSize: 1e6,
});

// ─── REDIS ADAPTER ────────────────────────────────────────────────────────────
(async () => {
    try {
        const { createClient }  = require('redis');
        const { createAdapter } = require('@socket.io/redis-adapter');
        const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
        const subClient = pubClient.duplicate();
        await Promise.all([pubClient.connect(), subClient.connect()]);
        io.adapter(createAdapter(pubClient, subClient));
        console.log('[Redis] Socket.io adapter configured');
    } catch (err) {
        console.warn('[Redis] Not configured:', err.message);
    }
})();

// ─── NATS ─────────────────────────────────────────────────────────────────────
(async () => {
    try {
        await initNats();
        setSubscriberIo(io);
        postRouter.setIo(io);
        storyRouter.setIo(io);
        await initPostSubscriber();
        console.log('[NATS] Subscribers initialized');
    } catch (err) {
        console.warn('[NATS] Initialization failed:', err.message);
    }
})();

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({ status: 'ok', pid: process.pid, uptime: Math.floor(process.uptime()), memory: process.memoryUsage().heapUsed });
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth.js'));
app.use('/api/post',         postRouter);
app.use('/api/conversation', require('./routes/conversation.js'));
app.use('/api/story',        storyRouter);
app.use('/api/ai',           require('./routes/ai.js'));
app.use('/api/admin',        require('./routes/admin.js'));

// ─── ERROR HANDLERS ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[Error]', err.stack);
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

    socket.on('disconnect', () => {
        for (const [userId, socketId] of onlineUsers.entries()) {
            if (socketId === socket.id) { onlineUsers.delete(userId); break; }
        }
        io.emit('updateUserList', getOnlineList());
    });
});

// ─── GRACEFUL SHUTDOWN ────────────────────────────────────────────────────────
const gracefulShutdown = (signal) => {
    console.log(`[${signal}] Graceful shutdown`);
    server.close(async () => {
        try { const mongoose = require('mongoose'); await mongoose.connection.close(); } catch {}
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// ─── START ────────────────────────────────────────────────────────────────────
server.listen(port, () => console.log(`[Worker ${process.pid}] Running on port ${port}`));