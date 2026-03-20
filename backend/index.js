require('dotenv').config();
const connectToMongo = require('./db.js');
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { initNats } = require('./lib/nats');
const { initPostSubscriber, setIo: setSubscriberIo } = require('./subscribers/postSubscriber');
const postRouter = require('./routes/post.js');
const storyRouter = require('./routes/story.js');

connectToMongo();

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;

app.use(helmet());
app.use(cookieParser());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: 'Too many requests.' });
app.use('/api/auth', limiter);

const allowedOrigins = [
    "http://localhost:3000",
    "https://social-square-social-media-platefor.vercel.app",
];

const io = socketIo(server, {
    cors: { origin: allowedOrigins, methods: ["GET", "POST"], credentials: true }
});

// ─── REDIS ADAPTER ────────────────────────────────────────────────────────────
(async () => {
    try {
        const { createClient } = require('redis');
        const { createAdapter } = require('@socket.io/redis-adapter');
        const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
        const subClient = pubClient.duplicate();
        await pubClient.connect();
        await subClient.connect();
        io.adapter(createAdapter(pubClient, subClient));
        console.log('Socket.io Redis adapter configured');
    } catch (err) {
        console.warn('Socket.io Redis adapter not configured:', err.message);
    }
})();

// ─── NATS + INJECT IO INTO ROUTES ─────────────────────────────────────────────
(async () => {
    try {
        await initNats();
        setSubscriberIo(io);        // postSubscriber — notifies followers on new post
        postRouter.setIo(io);       // post routes — likes, comments, new post, collab
        storyRouter.setIo(io);      // story routes — new story to followers
        await initPostSubscriber();
        console.log('NATS subscribers initialized');
    } catch (err) {
        console.warn('NATS initialization failed:', err.message);
    }
})();

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth.js'));
app.use('/api/post',         postRouter);
app.use('/api/conversation', require('./routes/conversation.js'));
app.use('/api/story',        storyRouter);
app.use('/api/ai',           require('./routes/ai.js'));
app.use('/api/admin',        require('./routes/admin.js'));

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────
const onlineUsers = [];

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Register user — join personal room for targeted events
    socket.on('registerUser', (userId) => {
        socket.join(userId);
        if (!onlineUsers.find(u => u.userId === userId)) {
            onlineUsers.push({ socketId: socket.id, userId });
        }
        io.emit('updateUserList', onlineUsers);
    });

    socket.on('logoutUser', (userId) => {
        const index = onlineUsers.findIndex(u => u.userId === userId);
        if (index !== -1) { onlineUsers.splice(index, 1); io.emit('updateUserList', onlineUsers); }
    });

    // Direct messages
    socket.on('sendMessage', ({ recipientId, content, senderName, sender, conversationId, _id, createdAt, isRead }) => {
        const recipient = onlineUsers.find(u => u.userId === recipientId);
        if (recipient) {
            io.to(recipient.socketId).emit('receiveMessage', {
                senderId: sender, socketId: socket.id,
                content, recipientId, senderName, conversationId, _id, createdAt, isRead
            });
        }
    });

    // Typing indicators
    socket.on('typing', ({ recipientId, senderName }) => {
        const recipient = onlineUsers.find(u => u.userId === recipientId);
        if (recipient) io.to(recipient.socketId).emit('userTyping', { senderName });
    });

    socket.on('stopTyping', ({ recipientId }) => {
        const recipient = onlineUsers.find(u => u.userId === recipientId);
        if (recipient) io.to(recipient.socketId).emit('userStoppedTyping');
    });

    // Message seen receipt
    socket.on('readMessage', ({ messageId, socketId }) => {
        io.to(socketId).emit('seenMessage', { messageId });
    });

    // Collaboration invite response (forwarded to post owner via REST, socket used for live update)
    socket.on('collaborationResponse', ({ postId, userId, accepted }) => {
        if (_io) io.emit('collaborationUpdate', { postId, userId, accepted });
    });

    socket.on('disconnect', () => {
        const index = onlineUsers.findIndex(u => u.socketId === socket.id);
        if (index !== -1) { onlineUsers.splice(index, 1); io.emit('updateUserList', onlineUsers); }
    });
});

server.listen(port, () => console.log('Server is running on port', port));