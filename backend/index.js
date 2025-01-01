const connectToMongo = require('./db.js');
const express = require('express');
var cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
connectToMongo();

const app = express();
const server = http.createServer(app);
const port = 5000;

const io = socketIo(server, {
    cors: {
        // origin: "http://localhost:3000",
        origin: "https://social-square.netlify.app/",
        methods: ["GET", "POST", "PATCH", "UPDATE", "PUT", "DELETE"]
    }
});

app.use(cors());
app.use(express.json());

// Available Routes
app.use('/api/auth', require('./routes/auth.js'));
app.use('/api/post', require('./routes/post.js'));
app.use('/api/conversation', require('./routes/conversation.js'));

const onlineUsers = []; // To keep track of online users

io.on('connection', (socket) => {
    console.log('A user connected with socket ID:', socket.id);

    // Add new user to online users
    socket.on('registerUser', (userId) => {
        if (!onlineUsers.find(u => u.userId === userId)) {
            onlineUsers.push({ socketId: socket.id, userId });
            console.log('User registered successfully:', { userId, socketId: socket.id });
            io.emit('updateUserList', onlineUsers); // Emit updated user list
            console.log('Updated online users:', onlineUsers);

        } else {
            console.log('User already registered:', userId);
            io.emit('updateUserList', onlineUsers); // Emit updated user list
            console.log('Updated online users:', onlineUsers);

        }
    });

    socket.on('logoutUser', (userId) => {
        const index = onlineUsers.findIndex((u) => u.userId === userId);
        if (index !== -1) {
            onlineUsers.splice(index, 1); // Remove the user from the list
            io.emit('updateUserList', onlineUsers); // Emit updated user list
            console.log(`User ${userId} has logged out.`);
        }
    });

    // Handle sending messages to a specific user
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
        io.to(socketId).emit("seenMessage", {
            messageId,
        });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        const index = onlineUsers.findIndex(u => u.socketId === socket.id);
        if (index !== -1) {
            const disconnectedUser = onlineUsers[index];
            console.log(`User disconnected:`, disconnectedUser);
            onlineUsers.splice(index, 1); // Remove disconnected user
            io.emit('updateUserList', onlineUsers); // Emit updated user list
            console.log('Updated online users:', onlineUsers);
        }
    });
});


server.listen(port, () => {
    console.log('Server is running on port', port);
});
