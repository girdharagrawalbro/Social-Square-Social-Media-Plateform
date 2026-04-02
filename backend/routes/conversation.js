const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const User = require('../models/User');
const verifyToken = require('../middleware/Verifytoken');
const redis = require('../lib/redis');

const CACHE_TTL = 60; // 60 seconds

async function getCache(key) {
    try { const v = await redis.get(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
async function setCache(key, data, ttl = CACHE_TTL) {
    try { await redis.set(key, JSON.stringify(data), 'EX', ttl); } catch { }
}
async function delCache(...keys) {
    try { if (keys.length) await redis.del(keys); } catch { }
}

let _io;
function setIo(io) { _io = io; }

// ─── CREATE CONVERSATION (PROTECTED) ──────────────────────────────────────────
router.post('/create', verifyToken, async (req, res) => {
    try {
        const { recipientId } = req.body;
        const senderId = req.userId;
        if (!recipientId) return res.status(400).json({ error: 'Recipient ID required' });

        const participantIds = [senderId, recipientId];
        const existing = await Conversation.findOne({ 'participants.userId': { $all: participantIds } }).lean();
        if (existing) return res.status(200).json(existing);

        const [senderUser, recipientUser] = await Promise.all([
            User.findById(senderId).select('fullname profile_picture').lean(),
            User.findById(recipientId).select('fullname profile_picture').lean(),
        ]);

        if (!senderUser || !recipientUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const conversation = await Conversation.create({
            participants: [
                { userId: senderId, fullname: senderUser.fullname, profilePicture: senderUser.profile_picture || '' },
                { userId: recipientId, fullname: recipientUser.fullname, profilePicture: recipientUser.profile_picture || '' },
            ]
        });

        await delCache(`convs:${senderId}`, `convs:${recipientId}`);
        res.status(201).json(conversation);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── FETCH CONVERSATIONS (PROTECTED) ──────────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const cacheKey = `convs:${userId}`;

        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const conversations = await Conversation.find({ 'participants.userId': userId })
            .sort({ lastMessageAt: -1 })
            .lean();

        await setCache(cacheKey, conversations, 30);
        res.status(200).json(conversations);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── FETCH MESSAGES (PROTECTED) ───────────────────────────────────────────────
router.post('/messages', verifyToken, async (req, res) => {
    try {
        const { recipientId, before, limit = 20 } = req.body;
        const senderId = req.userId;
        if (!recipientId) return res.status(400).json({ error: 'Recipient ID required' });

        const participantIds = [senderId, recipientId];
        const cacheKey = `msgs:${participantIds.sort().join(':')}:${before || 'latest'}:${limit}`;
        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const conversation = await Conversation.findOne({ 'participants.userId': { $all: participantIds } }).lean();
        if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

        const query = {
            conversationId: conversation._id,
            deletedAt: null,
        };

        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }

        const messages = await Message.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        // Reverse to maintain chronological order for the frontend
        messages.reverse();

        const hasMore = messages.length === limit;
        const result = { messages, conversation, hasMore };
        
        await setCache(cacheKey, result, 15);
        res.status(200).json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── SEARCH MESSAGES (PROTECTED) ──────────────────────────────────────────────
router.get('/messages/search', verifyToken, async (req, res) => {
    try {
        const { conversationId, q } = req.query;
        const userId = req.userId;
        if (!conversationId || !q) return res.status(400).json({ error: 'conversationId and q required' });

        // Authorization check: User must be part of the conversation
        const conv = await Conversation.findOne({ _id: conversationId, 'participants.userId': userId });
        if (!conv) return res.status(403).json({ error: 'Unauthorized access to conversation' });

        const messages = await Message.find({
            conversationId,
            deletedAt: null,
            $text: { $search: q },
        }).sort({ score: { $meta: 'textScore' } }).limit(20).lean();

        res.json(messages);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── SEND MESSAGE (PROTECTED) ─────────────────────────────────────────────────
router.post('/send', verifyToken, async (req, res) => {
    try {
        // Backwards-compatible alias for /messages/create used by frontend
        const { conversationId, senderName, content, recipientId, mediaUrl, mediaType, mediaName, mediaSize, storyReply } = req.body;
        const sender = req.userId;
        if (!conversationId || !recipientId) return res.status(400).json({ error: 'Required fields missing' });

        const message = await Message.create({
            conversationId,
            sender,
            content: content || '',
            media: mediaUrl ? { url: mediaUrl, type: mediaType, name: mediaName, size: mediaSize } : {},
            storyReply: storyReply || undefined,
        });

        await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: { id: message._id, message: content || `📎 ${mediaType || 'file'}`, isRead: false },
            lastMessageAt: new Date(),
            lastMessageBy: sender,
        });

        const senderUser = await User.findById(sender).select('fullname profile_picture').lean();
        const senderFullname = senderName || senderUser?.fullname || 'Someone';
        const notification = await Notification.create({
            recipient: recipientId,
            sender: {
                id: sender,
                fullname: senderFullname,
                profile_picture: senderUser?.profile_picture || ''
            },
            message: { id: message._id, content: content || `Sent a ${mediaType || 'file'}` },
        });

        await delCache(`convs:${sender}`, `convs:${recipientId}`, `msgs:${[sender, recipientId].sort().join(':')}`);

        if (_io) {
            _io.to(recipientId).emit('receiveMessage', { ...message.toObject(), senderId: sender, senderName: senderFullname });
            _io.to(recipientId).emit('newNotification', {
                _id: notification._id,
                recipient: notification.recipient,
                sender: notification.sender,
                type: notification.type,
                message: notification.message,
                post: notification.post,
                createdAt: notification.createdAt,
                read: notification.read,
            });
        }

        return res.status(201).json(message);
    } catch (err) { return res.status(500).json({ error: err.message }); }
});

router.post('/messages/create', verifyToken, async (req, res) => {
    try {
        const { conversationId, senderName, content, recipientId, mediaUrl, mediaType, mediaName, mediaSize } = req.body;
        const sender = req.userId;
        if (!conversationId || !recipientId)
            return res.status(400).json({ error: 'Required fields missing' });

        const message = await Message.create({
            conversationId, sender, content: content || '',
            media: mediaUrl ? { url: mediaUrl, type: mediaType, name: mediaName, size: mediaSize } : {},
        });

        await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: { id: message._id, message: content || `📎 ${mediaType || 'file'}`, isRead: false },
            lastMessageAt: new Date(),
            lastMessageBy: sender,
        });

        const senderUser = await User.findById(sender).select('fullname profile_picture').lean();
        const senderFullname = senderName || senderUser?.fullname || 'Someone';
        const notification = await Notification.create({
            recipient: recipientId,
            sender: {
                id: sender,
                fullname: senderFullname,
                profile_picture: senderUser?.profile_picture || ''
            },
            message: { id: message._id, content: content || `Sent a ${mediaType || 'file'}` },
        });

        await delCache(`convs:${sender}`, `convs:${recipientId}`, `msgs:${[sender, recipientId].sort().join(':')}`);

        if (_io) {
            _io.to(recipientId).emit('receiveMessage', {
                ...message.toObject(), senderId: sender, senderName,
            });

            // Push real-time notification for message events so bell updates instantly.
            _io.to(recipientId).emit('newNotification', {
                _id: notification._id,
                recipient: notification.recipient,
                sender: notification.sender,
                type: notification.type,
                message: notification.message,
                post: notification.post,
                createdAt: notification.createdAt,
                read: notification.read,
            });
        }

        res.status(201).json(message);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── EDIT MESSAGE (PROTECTED) ─────────────────────────────────────────────────
router.patch('/messages/:messageId', verifyToken, async (req, res) => {
    try {
        const { content } = req.body;
        const userId = req.userId;
        const message = await Message.findById(req.params.messageId);
        if (!message) return res.status(404).json({ error: 'Message not found' });
        if (message.sender.toString() !== userId) return res.status(403).json({ error: 'Unauthorized to edit this message' });

        message.content = content;
        message.edited = true;
        message.editedAt = new Date();
        await message.save();

        if (_io) {
            const conv = await Conversation.findById(message.conversationId).select('participants').lean();
            conv?.participants?.forEach(p => {
                _io.to(p.userId.toString()).emit('messageEdited', {
                    messageId: message._id,
                    content,
                    conversationId: message.conversationId,
                });
            });
        }

        await delCache(`msgs:${message.conversationId}`);
        res.json(message);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── DELETE MESSAGE (PROTECTED) ────────────────────────────────────────────────
router.delete('/messages/:messageId', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const message = await Message.findOne({ _id: req.params.messageId, sender: userId });
        if (!message) return res.status(404).json({ error: 'Message not found or unauthorized' });

        message.deletedAt = new Date();
        message.content = '';
        await message.save();

        if (_io) {
            const conv = await Conversation.findById(message.conversationId).select('participants').lean();
            conv?.participants?.forEach(p => {
                _io.to(p.userId.toString()).emit('messageDeleted', {
                    messageId: message._id,
                    conversationId: message.conversationId,
                });
            });
        }
        await delCache(`msgs:${message.conversationId}`);
        res.json({ message: 'Message deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── REACT TO MESSAGE (PROTECTED) ─────────────────────────────────────────────
router.post('/messages/:messageId/react', verifyToken, async (req, res) => {
    try {
        const { emoji } = req.body;
        const userId = req.userId;
        const message = await Message.findById(req.params.messageId);
        if (!message) return res.status(404).json({ error: 'Not found' });

        if (message.reactions.get(userId) === emoji) {
            message.reactions.delete(userId);
        } else {
            message.reactions.set(userId, emoji);
        }
        await message.save();

        const reactionsObj = Object.fromEntries(message.reactions);
        if (_io) {
            const conv = await Conversation.findById(message.conversationId).select('participants').lean();
            conv?.participants?.forEach(p => {
                _io.to(p.userId.toString()).emit('messageReaction', {
                    messageId: message._id,
                    conversationId: message.conversationId,
                    reactions: reactionsObj,
                });
            });
        }

        await delCache(`msgs:${message.conversationId}`);
        res.json({ reactions: reactionsObj });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── MARK READ (PROTECTED) ────────────────────────────────────────────────────
router.post('/messages/mark-read', verifyToken, async (req, res) => {
    try {
        const { unreadMessageIds, lastMessage } = req.body;
        const userId = req.userId;
        if (!Array.isArray(unreadMessageIds)) return res.status(400).json({ error: 'Invalid' });

        await Message.updateMany({ _id: { $in: unreadMessageIds } }, { $set: { isRead: true } });

        if (lastMessage) {
            const msg = await Message.findById(lastMessage).lean();
            if (msg) {
                await Conversation.findByIdAndUpdate(msg.conversationId, {
                    'lastMessage.isRead': true,
                    lastMessageBy: msg.sender,
                    lastMessageAt: msg.createdAt,
                });
                await delCache(`convs:${msg.sender}`);
            }
        }

        res.json({ message: 'Marked as read', unreadMessageIds });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── NOTIFICATIONS (PROTECTED) ────────────────────────────────────────────────
router.get('/notifications', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const [notifications, total] = await Promise.all([
            Notification.find({ recipient: userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Notification.countDocuments({ recipient: userId })
        ]);

        res.status(200).json({
            notifications,
            total,
            page,
            hasNextPage: total > skip + notifications.length
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/notifications/mark-read', verifyToken, async (req, res) => {
    try {
        const { Ids } = req.body;
        const userId = req.userId;
        // Verify notifications belong to the user
        await Notification.updateMany({ _id: { $in: Ids }, recipient: userId }, { $set: { read: true } });
        res.json({ Ids });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── BACKWARD-COMPAT: FETCH CONVERSATIONS BY USER ID (PROTECTED) ───────────
router.get('/:participantId', verifyToken, async (req, res) => {
    try {
        const { participantId } = req.params;
        const userId = req.userId;

        if (participantId !== userId) {
            return res.status(403).json({ error: 'Unauthorized access' });
        }

        const cacheKey = `convs:${userId}`;
        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const conversations = await Conversation.find({ 'participants.userId': userId })
            .sort({ lastMessageAt: -1 })
            .lean();

        await setCache(cacheKey, conversations, 30);
        return res.status(200).json(conversations);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
module.exports.setIo = setIo;