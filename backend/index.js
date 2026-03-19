require('dotenv').config();
const connectToMongo = require('./db.js');
const express = require('express');
var cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initNats } = require('./lib/nats');
const { initPostSubscriber, setIo } = require('./subscribers/postSubscriber');
const cookieParser = require('cookie-parser');

connectToMongo();

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;

app.use(helmet());
app.use(cookieParser());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/auth', limiter);

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3000/login",
  "https://social-square-social-media-platefor.vercel.app",
];

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Redis adapter for socket.io
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

// Initialize NATS and subscribers
(async () => {
    try {
        await initNats();
        setIo(io); // inject socket.io into subscriber
        await initPostSubscriber();
        console.log('NATS subscribers initialized');
    } catch (err) {
        console.warn('NATS initialization failed (non-critical):', err.message);
    }
})();

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth.js'));
app.use('/api/post', require('./routes/post.js'));
app.use('/api/conversation', require('./routes/conversation.js'));

const onlineUsers = [];

io.on('connection', (socket) => {
    console.log('A user connected with socket ID:', socket.id);

    socket.on('registerUser', (userId) => {
        socket.join(userId); // join personal room for targeted notifications
        if (!onlineUsers.find(u => u.userId === userId)) {
            onlineUsers.push({ socketId: socket.id, userId });
            console.log('User registered successfully:', { userId, socketId: socket.id });
            io.emit('updateUserList', onlineUsers);
        } else {
            console.log('User already registered:', userId);
            io.emit('updateUserList', onlineUsers);
        }
    });

    socket.on('logoutUser', (userId) => {
        const index = onlineUsers.findIndex((u) => u.userId === userId);
        if (index !== -1) {
            onlineUsers.splice(index, 1);
            io.emit('updateUserList', onlineUsers);
            console.log(`User ${userId} has logged out.`);
        }
    });

    socket.on('sendMessage', ({ recipientId, content, senderName, sender, conversationId, _id, createdAt, isRead }) => {
        console.log(`Message from ${senderName} to ${recipientId}:`, content);
        const recipient = onlineUsers.find(u => u.userId === recipientId);
        if (recipient) {
            io.to(recipient.socketId).emit('receiveMessage', {
                senderId: sender,
                socketId: socket.id,
                content,
                recipientId,
                senderName,
                conversationId,
                _id,
                createdAt,
                isRead
            });
            console.log(`Message sent to ${recipientId}`);
        } else {
            console.log(`Recipient ${recipientId} not found or not online.`);
        }
    });

    socket.on("readMessage", ({ messageId, socketId }) => {
        io.to(socketId).emit("seenMessage", { messageId });
    });

    socket.on('disconnect', () => {
        const index = onlineUsers.findIndex(u => u.socketId === socket.id);
        if (index !== -1) {
            const disconnectedUser = onlineUsers[index];
            console.log(`User disconnected:`, disconnectedUser);
            onlineUsers.splice(index, 1);
            io.emit('updateUserList', onlineUsers);
        }
    });
});

server.listen(port, () => {
    console.log('Server is running on port', port);
});