require('dotenv').config();


const connectToMongo = require('./db.js');
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const compression = require('compression');
const { RateLimiterMemory, RateLimiterRedis } = require('rate-limiter-flexible');
const cookieParser = require('cookie-parser');
const redis = require('./lib/redis');
const User = require('./models/User');
const Conversation = require('./models/Conversation');
require('./models/Recommendation');
const verifyToken = require('./middleware/Verifytoken');
const logger = require('./utils/logger');


connectToMongo();

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;

process.on('unhandledRejection', (reason, promise) => {
    logger.error('[Unhandled Rejection]', { reason, promise: String(promise) });
});
process.on('uncaughtException', (err) => {
    logger.error('[Uncaught Exception]', err);
});

const { correlationMiddleware } = require('./middleware/correlation');

app.set('trust proxy', 1);
app.use(correlationMiddleware);

// ─── CORS ─────────────────────────────────────────────────────────────────────
let allowedOrigins;
if (process.env.ALLOWED_ORIGINS) {
    allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
} else {
    if (process.env.NODE_ENV === 'production') {
        console.error('[SECURITY] ALLOWED_ORIGINS not set in production! Defaulting to localhost only.');
    }
    allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

app.use(cors({
    origin: allowedOrigins, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-fingerprint', 'x-request-id']
}));

// ─── SECURITY + COMPRESSION ───────────────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'none'"],
            frameAncestors: ["'none'"]
        }
    },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginEmbedderPolicy: false,
}));
app.use(compression({ level: 6, threshold: 1024 }));
app.use(cookieParser());

// ─── RATE LIMITING ────────────────────────────────────────────────────────────
const createRateLimiterMiddleware = (options) => {
    let limiter;
    if (process.env.DISABLE_REDIS === 'true' || !process.env.REDIS_URL || !redis) {
        limiter = new RateLimiterMemory({ points: options.max, duration: options.windowMs / 1000 });
    } else {
        limiter = new RateLimiterRedis({
            storeClient: redis,
            points: options.max,
            duration: options.windowMs / 1000,
            keyPrefix: options.keyPrefix
        });
    }

    return async (req, res, next) => {
        if (options.skip && options.skip(req)) return next();
        const key = req.ip;
        try {
            await limiter.consume(key);
            next();
        } catch (err) {
            res.status(429).json(options.message);
        }
    };
};

const authWriteLimiter = createRateLimiterMiddleware({
    keyPrefix: 'rl_auth',
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many attempts. Try again in 15 minutes.' },
    skip: (req) => {
        const safePaths = ['/refresh', '/get', '/other-users', '/search', '/other-user', '/user', '/notification-settings'];
        return safePaths.some(p => req.path.includes(p));
    }
});

const apiLimiter = createRateLimiterMiddleware({
    keyPrefix: 'rl_api',
    windowMs: 60 * 1000,
    max: 500,
    message: { error: 'Too many requests.' },
    skip: (req) => req.path.startsWith('/admin') || req.path.startsWith('/socket.io'),
});

const reportLimiter = createRateLimiterMiddleware({
    keyPrefix: 'rl_report',
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { error: 'Too many reports.' }
});


app.use('/api/auth', authWriteLimiter);
app.use('/api/admin/report', reportLimiter);
app.use('/api', apiLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Always log requests, using lightweight 'tiny' format in production with timing
const morgan = require('morgan');
app.use(morgan(process.env.NODE_ENV === 'production' ? 'tiny' : 'dev'));

const io = socketIo(server, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    maxHttpBufferSize: 1e6,
    connectTimeout: 10000,
});

async function initRedis() {
    if (process.env.DISABLE_REDIS === 'true' || !process.env.REDIS_URL) return;
    try {
        const { createClient } = require('redis');
        const { createAdapter } = require('@socket.io/redis-adapter');
        const pubClient = createClient({ url: process.env.REDIS_URL });
        pubClient.on('error', err => logger.error('[Redis Pub]', err.message));
        const subClient = pubClient.duplicate();
        subClient.on('error', err => logger.error('[Redis Sub]', err.message));
        await Promise.all([pubClient.connect(), subClient.connect()]);
        io.adapter(createAdapter(pubClient, subClient));
    } catch (err) {
        logger.warn('[Redis] Failed:', err.message);
    }
}

async function initPubSubLayer() {
    try {
        const { initPubSub } = require('./lib/pubsub');
        const { initPostSubscriber, setIo: setSubscriberIo } = require('./subscribers/postSubscriber');
        setSubscriberIo(io);
        await initPubSub();
        await initPostSubscriber();
        const { initWorker: initRecommenderWorker } = require('./recommenderWorker');
        await initRecommenderWorker();
    } catch (err) {
        logger.warn('[PubSub] Failed:', err.message);
    }
}

async function initCleanupJobs() {
    try {
        const { scheduleCleanup } = require('./queues/cleanupQueue');
        await scheduleCleanup();
    } catch (err) {
        logger.warn('[Cleanup] Failed to schedule:', err.message);
    }
}

async function initAutoPostJobs() {
    try {
        const { scheduleAutoPost } = require('./queues/autoPostQueue');
        await scheduleAutoPost();
    } catch (err) {
        logger.warn('[AutoPost] Failed to schedule:', err.message);
    }
}


const postRouter = require('./routes/post.js');
const storyRouter = require('./routes/story.js');
const conversationRouter = require('./routes/conversation.js');
const liveRouter = require('./routes/live.js');
const authRouter = require('./routes/auth.js');

const notificationUtils = require('./lib/notification.js');
notificationUtils.setIo(io);

const aiChatService = require('./services/aiChatService');
aiChatService.setIo(io);

postRouter.setIo(io);
storyRouter.setIo(io);
conversationRouter.setIo(io);
liveRouter.setIo(io);
authRouter.setIo(io);

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
    console.log("FCM Token Called")
    const { token } = req.body;
    await User.findByIdAndUpdate(req.userId, { fcmToken: token });
    res.json({ success: true });
});

// Web Push: expose VAPID public key to the client
app.get('/api/user/vapid-public-key', (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
});

// Web Push: save browser push subscription
app.post('/api/user/web-push-subscription', verifyToken, async (req, res) => {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Invalid subscription object' });
    }
    await User.findByIdAndUpdate(req.userId, { webPushSubscription: subscription });
    res.json({ success: true });
});

// Web Push: remove subscription (on logout / denied)
app.delete('/api/user/web-push-subscription', verifyToken, async (req, res) => {
    await User.findByIdAndUpdate(req.userId, { webPushSubscription: null });
    res.json({ success: true });
});


app.use('/api/auth', authRouter);
app.use('/api/post', postRouter);
app.use('/api/goal', require('./routes/goal.js'));
app.use('/api/idea', require('./routes/idea.js'));
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
app.use('/api/knowledge', require('./routes/knowledge.js'));
app.use('/api/e2ee', require('./routes/e2ee.js'));
app.use('/api/activity', require('./routes/activity.js'));

app.use((err, req, res, next) => {
    logger.error('[Error]', err);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
});
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

const socketGlobalLimiter = (process.env.DISABLE_REDIS === 'true' || !process.env.REDIS_URL)
    ? new RateLimiterMemory({ points: 10, duration: 1 })
    : new RateLimiterRedis({ storeClient: redis, points: 10, duration: 1, keyPrefix: 'socket_global' });

const socketStrictLimiter = (process.env.DISABLE_REDIS === 'true' || !process.env.REDIS_URL)
    ? new RateLimiterMemory({ points: 2, duration: 1 })
    : new RateLimiterRedis({ storeClient: redis, points: 2, duration: 1, keyPrefix: 'socket_strict' });

const activeCalls = new Map();
// Module-level timer map for live stream auto-end — avoids global state anti-pattern
const liveEndTimers = new Map();

// Periodically clean up stale active calls to prevent Map unbounded growth
setInterval(() => {
    const now = Date.now();
    for (const [convId, call] of activeCalls.entries()) {
        // If a call has been active for more than 4 hours, remove it
        if (now - call.startTime > 4 * 60 * 60 * 1000) {
            activeCalls.delete(convId);
            logger.debug(`[Call Cleanup] Removed stale call for conversation: ${convId}`);
        }
    }
}, 60 * 60 * 1000); // Check every hour

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
        logger.error('[saveCallMessage Error]:', err);
    }
}

io.on('connection', (socket) => {
    logger.debug(`[Socket] Connected: ${socket.id} from ${socket.handshake.address}`);
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
            logger.warn(`[Socket Rate Limit] Blocked ${event} from ${key}`);
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
            //  Track active timestamp for TTL cleanup
            await redis.zadd('presence_heartbeats', Date.now(), userId);

            // 1. Send list of online users (REMOVED: Bulk broadcast of all online users disabled for performance)

            // 2. Broadcast new user
            socket.broadcast.emit('userOnline', { userId, socketId: socket.id });

            // 3. Update MongoDB
            await User.findByIdAndUpdate(userId, { isOnline: true });

            // 3.1. Mark undelivered messages to this user as delivered
            try {
                const Conversation = require('./models/Conversation');
                const Message = require('./models/Message');
                const userConvs = await Conversation.find({ 'participants.userId': userId }).select('_id');
                if (userConvs.length > 0) {
                    const convIds = userConvs.map(c => c._id);
                    const undeliveredMessages = await Message.find({
                        conversationId: { $in: convIds },
                        sender: { $ne: userId },
                        isDelivered: false
                    });

                    if (undeliveredMessages.length > 0) {
                        const msgIds = undeliveredMessages.map(m => m._id);
                        await Message.updateMany(
                            { _id: { $in: msgIds } },
                            { $set: { isDelivered: true }, $addToSet: { deliveredTo: userId } }
                        );

                        // Group by sender to notify them
                        const senderGroups = {};
                        undeliveredMessages.forEach(m => {
                            const sId = m.sender.toString();
                            if (!senderGroups[sId]) senderGroups[sId] = [];
                            senderGroups[sId].push(m._id);
                        });

                        for (const [sId, mIds] of Object.entries(senderGroups)) {
                            const sidSocket = await redis.hget('online_users', sId);
                            if (sidSocket) {
                                io.to(sidSocket).emit('messagesDelivered', { messageIds: mIds });
                            }
                        }
                    }
                }
            } catch (err) {
                logger.error('[Socket] Delivered state update error:', err.message);
            }

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
                    logger.debug(`[Socket] Restored active call to reconnected user: ${userId}`);
                    break;
                }
            }
        } catch (err) {
            logger.error('[Socket] Redis error (registerUser):', err.message);
        }
    });

    // ─── CHECK ACTIVE CALL (Solves page refresh race condition) ───────────────────
    socket.on('checkActiveCall', async () => {
        const userId = socket.userId;
        if (!userId) return;

        logger.debug(`🔍 [Socket] User ${userId} requested active call check`);
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
                logger.debug(`[Socket] Restored active incoming call to ${userId} on request`);
                break;
            }
        }
    });

    socket.on('heartbeat', async (userId) => {
        if (!userId) return;
        try {
            await redis.zadd('presence_heartbeats', Date.now(), userId);
        } catch (err) {
            logger.error('[Socket] Heartbeat error:', err.message);
        }
    });

    socket.on('logoutUser', async (userId) => {
        try {
            await redis.hdel('online_users', userId);
            await redis.zrem('presence_heartbeats', userId);
            io.emit('userOffline', userId);
            await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
        } catch (err) {
            logger.error('[Socket] Redis error (logoutUser):', err.message);
        }
    });

    socket.on('typing', async ({ recipientId, conversationId, senderName }) => {
        try {
            if (conversationId) {
                const conv = await Conversation.findById(conversationId).select('participants').lean();
                if (conv) {
                    for (const p of conv.participants) {
                        if (p.userId.toString() !== socket.userId) {
                            const sid = await redis.hget('online_users', p.userId.toString());
                            if (sid) io.to(sid).emit('userTyping', { senderName, conversationId });
                        }
                    }
                }
            } else if (recipientId) {
                const sid = await redis.hget('online_users', recipientId);
                if (sid) io.to(sid).emit('userTyping', { senderName });
            }
        } catch (err) {
            logger.error('[Socket] Redis error (typing):', err.message);
        }
    });

    socket.on('stopTyping', async ({ recipientId, conversationId }) => {
        try {
            if (conversationId) {
                const conv = await Conversation.findById(conversationId).select('participants').lean();
                if (conv) {
                    for (const p of conv.participants) {
                        if (p.userId.toString() !== socket.userId) {
                            const sid = await redis.hget('online_users', p.userId.toString());
                            if (sid) io.to(sid).emit('userStoppedTyping', { conversationId });
                        }
                    }
                }
            } else if (recipientId) {
                const sid = await redis.hget('online_users', recipientId);
                if (sid) io.to(sid).emit('userStoppedTyping');
            }
        } catch (err) {
            logger.error('[Socket] Redis error (stopTyping):', err.message);
        }
    });

    socket.on('readMessage', ({ messageId, recipientId }) => {
        if (recipientId) io.to(recipientId).emit('seenMessage', { messageId });
    });

    socket.on('messageDelivered', async ({ messageId, conversationId, senderId }) => {
        try {
            const Message = require('./models/Message');
            await Message.findByIdAndUpdate(messageId, { isDelivered: true, $addToSet: { deliveredTo: socket.userId } });
            if (senderId) {
                const sid = await redis.hget('online_users', senderId.toString());
                if (sid) io.to(sid).emit('messagesDelivered', { messageIds: [messageId] });
            }
        } catch (err) {
            logger.error('[Socket] messageDelivered error:', err.message);
        }
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

    // ─── 1-ON-1 CALLS ─────────────────────────────────────────────────────────────
    socket.on('initiateCall', ({ recipientId, type, conversationId, callerName, callerAvatar }) => {
        if (recipientId) {
            // 60-second ring timeout — if not accepted, auto-clean and notify both parties
            const ringTimeoutId = setTimeout(() => {
                const call = activeCalls.get(conversationId);
                if (call && !call.accepted) {
                    const content = type === 'video' ? '📹 Missed video chat' : '📞 Missed voice call';
                    saveCallMessage(io, conversationId, socket.userId, content);
                    activeCalls.delete(conversationId);
                    io.to(recipientId).emit('callTimeout', { conversationId });
                    io.to(socket.userId).emit('callTimeout', { conversationId });
                    logger.info(`[Call] Unanswered call ${conversationId} cleaned up after 60s ring timeout`);
                }
            }, 60000);

            activeCalls.set(conversationId, {
                startTime: Date.now(),
                type,
                callerId: socket.userId,
                recipientId,
                isGroup: false,
                accepted: false,
                ringTimeoutId,
            });

            const callData = {
                callerId: socket.userId,
                callerName,
                callerAvatar,
                type,
                conversationId,
                isGroup: false
            };

            io.to(recipientId).emit('incomingCall', callData);

            // Dispatch Data-Only FCM Notification to wake up the app for VoIP screen
            try {
                const User = require('./models/User');
                const { sendCallPushNotification } = require('./utils/firebase');
                User.findById(recipientId).select('fcmToken').lean().then(user => {
                    if (user && user.fcmToken) {
                        sendCallPushNotification(user.fcmToken, callData).catch(err => {
                            logger.error(`[Call Push] Error sending to ${recipientId}: ${err.message}`);
                        });
                    }
                }).catch(err => {
                    logger.error(`[Call Push] DB error fetching user ${recipientId}: ${err.message}`);
                });
            } catch (e) {
                logger.error(`[Call Push] Failed to trigger sendCallPushNotification: ${e.message}`);
            }
        }
    });

    socket.on('acceptCall', ({ callerId, conversationId }) => {
        if (callerId) {
            const call = activeCalls.get(conversationId);
            if (call) {
                // Cancel the ring timeout now that the call is answered
                if (call.ringTimeoutId) clearTimeout(call.ringTimeoutId);
                call.accepted = true;
                call.connectTime = Date.now();
            }
            io.to(callerId).emit('callAccepted', { receiverId: socket.userId, conversationId });
        }
    });

    socket.on('declineCall', ({ callerId, conversationId }) => {
        let callToDecline = null;
        let foundConvId = conversationId || null;

        if (conversationId && activeCalls.has(conversationId)) {
            callToDecline = activeCalls.get(conversationId);
        } else if (callerId) {
            for (const [convId, call] of activeCalls.entries()) {
                if (call.callerId === callerId && call.recipientId === socket.userId) {
                    callToDecline = call;
                    foundConvId = convId;
                    break;
                }
            }
        }

        if (callToDecline && foundConvId) {
            // Cancel the ring timeout before deleting the call entry
            if (callToDecline.ringTimeoutId) clearTimeout(callToDecline.ringTimeoutId);
            const content = callToDecline.type === 'video' ? '📹 Missed video chat' : '📞 Missed voice call';
            saveCallMessage(io, foundConvId, callToDecline.callerId, content);
            activeCalls.delete(foundConvId);
        }

        if (callerId) {
            io.to(callerId).emit('callDeclined', { conversationId: foundConvId });
        }
    });

    socket.on('endCall', ({ recipientId, conversationId }) => {
        if (conversationId) {
            const call = activeCalls.get(conversationId);
            if (call) {
                // Cancel the ring timeout if the call ends before it fires
                if (call.ringTimeoutId) clearTimeout(call.ringTimeoutId);
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
        }

        if (recipientId) {
            io.to(recipientId).emit('callEnded', { conversationId });
        }
    });

    // ─── GROUP CALLS ───────────────────────────────────────────────────────────────
    socket.on('initiateGroupCall', async ({ conversationId, type, callerName, callerAvatar, groupName }) => {
        try {
            const Conversation = require('./models/Conversation');
            const conv = await Conversation.findById(conversationId).select('participants groupName isGroup').lean();
            if (!conv) return;

            const effectiveGroupName = groupName || conv.groupName || 'Group Call';

            activeCalls.set(conversationId, {
                startTime: Date.now(),
                type,
                callerId: socket.userId,
                conversationId,
                groupName: effectiveGroupName,
                isGroup: true,
                participants: [socket.userId],
                connectedParticipants: [socket.userId],
                connectTime: Date.now()
            });

            socket.join(`call:group:${conversationId}`);

            conv.participants.forEach(p => {
                const pId = p.userId ? p.userId.toString() : p.toString();
                if (pId !== socket.userId) {
                    io.to(pId).emit('incomingGroupCall', {
                        callerId: socket.userId,
                        callerName,
                        callerAvatar,
                        groupName: effectiveGroupName,
                        type,
                        conversationId,
                        isGroup: true
                    });
                }
            });
            logger.debug(`[Socket Group Call] Initiated for conversation ${conversationId} by ${socket.userId}`);
        } catch (err) {
            logger.error('[Socket initiateGroupCall Error]:', err.message);
        }
    });

    socket.on('joinGroupCall', ({ conversationId, user }) => {
        try {
            socket.join(`call:group:${conversationId}`);
            const call = activeCalls.get(conversationId);
            if (call && call.isGroup) {
                if (!call.connectedParticipants.includes(socket.userId)) {
                    call.connectedParticipants.push(socket.userId);
                }
                // Notify other participants in the room
                socket.to(`call:group:${conversationId}`).emit('groupCallUserJoined', {
                    userId: socket.userId,
                    user,
                    conversationId
                });
                // Send list of already connected participants back to joining user
                socket.emit('groupCallExistingUsers', {
                    participants: call.connectedParticipants.filter(id => id !== socket.userId),
                    conversationId
                });
            }
        } catch (err) {
            logger.error('[Socket joinGroupCall Error]:', err.message);
        }
    });

    socket.on('leaveGroupCall', ({ conversationId }) => {
        try {
            socket.leave(`call:group:${conversationId}`);
            socket.to(`call:group:${conversationId}`).emit('groupCallUserLeft', {
                userId: socket.userId,
                conversationId
            });

            const call = activeCalls.get(conversationId);
            if (call && call.isGroup) {
                call.connectedParticipants = call.connectedParticipants.filter(id => id !== socket.userId);
                if (call.connectedParticipants.length <= 1) {
                    const durationSec = Math.floor((Date.now() - call.connectTime) / 1000);
                    const minutes = Math.floor(durationSec / 60);
                    const seconds = durationSec % 60;
                    const durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
                    const content = call.type === 'video'
                        ? `📹 Group video chat ended - ${durationStr}`
                        : `📞 Group voice call ended - ${durationStr}`;
                    saveCallMessage(io, conversationId, call.callerId, content);
                    activeCalls.delete(conversationId);
                    io.to(`call:group:${conversationId}`).emit('groupCallEnded', { conversationId });
                }
            }
        } catch (err) {
            logger.error('[Socket leaveGroupCall Error]:', err.message);
        }
    });

    // ─── UNIVERSAL WEBRTC SIGNALING RELAY ─────────────────────────────────────────
    socket.on('webrtc-signal', ({ to, signal, conversationId }) => {
        if (to) {
            io.to(to).emit('webrtc-signal', {
                from: socket.userId,
                signal,
                conversationId
            });
        }
    });

    socket.on('disconnect', async (reason) => {
        logger.debug(`[Socket] Disconnected: ${socket.id} (${socket.userId || 'unregistered'}) — reason: ${reason}`);
        const userId = socket.userId;
        if (userId) {
            try {
                const currentSid = await redis.hget('online_users', userId);
                if (currentSid === socket.id) {
                    await redis.hdel('online_users', userId);
                    await redis.zrem('presence_heartbeats', userId);
                    io.emit('userOffline', userId);
                    await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
                }
            } catch (err) {
                logger.error('[Socket] Redis error (disconnect):', err.message);
            }

            // Clean up any active calls if this user disconnected
            for (const [convId, call] of activeCalls.entries()) {
                if (call.isGroup) {
                    if (call.connectedParticipants && call.connectedParticipants.includes(userId)) {
                        call.connectedParticipants = call.connectedParticipants.filter(id => id !== userId);
                        io.to(`call:group:${convId}`).emit('groupCallUserLeft', { userId, conversationId: convId });
                        if (call.connectedParticipants.length <= 1) {
                            const durationSec = Math.floor((Date.now() - (call.connectTime || call.startTime)) / 1000);
                            const minutes = Math.floor(durationSec / 60);
                            const seconds = durationSec % 60;
                            const durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
                            const content = call.type === 'video'
                                ? `📹 Group video chat ended - ${durationStr}`
                                : `📞 Group voice call ended - ${durationStr}`;
                            saveCallMessage(io, convId, call.callerId, content);
                            activeCalls.delete(convId);
                            io.to(`call:group:${convId}`).emit('groupCallEnded', { conversationId: convId });
                        }
                    }
                } else {
                    if (call.callerId === userId || call.recipientId === userId) {
                        const otherUserId = call.callerId === userId ? call.recipientId : call.callerId;
                        io.to(otherUserId).emit('callEnded', { conversationId: convId });
                        if (call.accepted && call.connectTime) {
                            const durationSec = Math.floor((Date.now() - call.connectTime) / 1000);
                            const minutes = Math.floor(durationSec / 60);
                            const seconds = durationSec % 60;
                            const durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
                            const content = call.type === 'video'
                                ? `📹 Video chat ended - ${durationStr}`
                                : `📞 Voice call ended - ${durationStr}`;
                            saveCallMessage(io, convId, call.callerId, content);
                        }
                        activeCalls.delete(convId);
                    }
                }
            }
        }

        // If host disconnected unexpectedly (internet drop, browser crash, tab close)
        if (socket.isLiveHostOf) {
            const streamId = socket.isLiveHostOf;

            logger.info(`[Live Stream] Host ${socket.userId} disconnected from stream ${streamId}. Starting 30s auto-end countdown...`);

            // Notify viewers host is trying to reconnect
            io.to(`live:${streamId}`).emit('live-paused', streamId);

            const autoEndTimer = setTimeout(async () => {
                try {
                    const LiveStream = require('./models/LiveStream');
                    await LiveStream.findByIdAndUpdate(streamId, { status: 'ended', endTime: Date.now() });
                    io.to(`live:${streamId}`).emit('live-ended', streamId);
                    logger.info(`[Live Stream] Stream ${streamId} automatically ended: Host did not reconnect within 30s.`);
                } catch (err) {
                    logger.error('[Live Stream] Auto-end failed:', err.message);
                } finally {
                    liveEndTimers.delete(streamId);
                }
            }, 30000); // 30 seconds buffer
            liveEndTimers.set(streamId, autoEndTimer);
        }

        // Update viewer count for any live rooms this socket was in
        for (const room of socket.rooms) {
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
        }
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
                if (liveEndTimers.has(streamId)) {
                    clearTimeout(liveEndTimers.get(streamId));
                    liveEndTimers.delete(streamId);
                    logger.info(`[Live Stream] Host reconnected to stream ${streamId}. Auto-end timer cancelled.`);
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

//  ─── PRESENCE HOUSEKEEPING (TTL Cleanup) ──────────────────────────────────
// Runs every 30s to evict users who haven't sent a heartbeat in > 60s
setInterval(async () => {
    if (!redis || process.env.DISABLE_REDIS === 'true') return;
    try {
        const now = Date.now();
        const threshold = now - 60000; // 60s inactivity
        const staleIds = await redis.zrangebyscore('presence_heartbeats', '-inf', threshold);

        if (staleIds.length > 0) {

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
        logger.error('[Presence Cleanup] Error:', err.message);
    }
}, 30000);

// ─── PERIODIC GC HINT ─────────────────────────────────────────────────────────
// Ask V8 to run GC every 5 minutes if --expose-gc flag is set
// Add to package.json: "start": "node --max-old-space-size=400 --expose-gc index.js"
if (global.gc) {
    setInterval(() => {
        global.gc();
        const mb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        if (mb > 300) logger.warn(`[Memory] Heap at ${mb}MB after GC`);
    }, 5 * 60 * 1000);
}

// ─── GRACEFUL SHUTDOWN ────────────────────────────────────────────────────────
const gracefulShutdown = (signal) => {
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
    await initAutoPostJobs();
    const { scheduleDailyDigest } = require('./queues/digestQueue');
    await scheduleDailyDigest();

    try {
        const { initWikiWorker } = require('./workers/wikiWorker');
        await initWikiWorker();
    } catch (err) {
        logger.warn('[WikiWorker] Failed to initialize:', err.message);
    }

    try {
        require('./queues/moderationQueue');
        logger.info('[Moderation] Initialized');
    } catch (err) {
        logger.warn('[Moderation] Failed to initialize:', err.message);
    }
    server.listen(port, () => {
        logger.info(`[Server] Running on port ${port} (PID: ${process.pid})`);
    });
}

bootstrap().catch(err => {
    logger.error('[Bootstrap] Failed:', err.message);
    process.exit(1);
});
