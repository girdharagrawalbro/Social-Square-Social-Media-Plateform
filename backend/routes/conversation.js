const express = require('express');
const router = express.Router();

// Debug middleware
router.use((req, res, next) => {
    console.log(`[Conversation] ${req.method} ${req.url}`);
    next();
});
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const User = require('../models/User');
const verifyToken = require('../middleware/Verifytoken');
const redis = require('../lib/redis');
const mongoose = require('mongoose');

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

// ─── CLEAR CHAT (PROTECTED) ──────────────────────────────────────────────────
router.delete('/:conversationId/clear', verifyToken, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.userId;
        console.log(`[Conversation] Clear request: ${conversationId} by ${userId}`);

        if (!mongoose.Types.ObjectId.isValid(conversationId)) {
            return res.status(400).json({ error: 'Invalid conversation ID' });
        }

        const conv = await Conversation.findOne({ _id: conversationId, 'participants.userId': userId });
        if (!conv) return res.status(403).json({ error: 'Unauthorized to clear this chat' });

        await Message.deleteMany({ conversationId });

        await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: null,
            lastMessageAt: new Date(),
        });

        const participants = conv.participants.map(p => p.userId.toString());
        await delCache(...participants.map(p => `convs:${p}`), `msgs:${participants.sort().join(':')}`);

        res.json({ message: 'Chat cleared' });
    } catch (err) {
        console.error('[Conversation] Clear error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── DELETE CHAT (PROTECTED) ─────────────────────────────────────────────────
router.delete('/:conversationId', verifyToken, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.userId;
        console.log(`[Conversation] Delete request: ${conversationId} by ${userId}`);

        if (!mongoose.Types.ObjectId.isValid(conversationId)) {
            return res.status(400).json({ error: 'Invalid conversation ID' });
        }

        const conv = await Conversation.findOne({ _id: conversationId, 'participants.userId': userId });
        if (!conv) return res.status(403).json({ error: 'Unauthorized to delete this chat' });

        const participants = conv.participants.map(p => p.userId.toString());

        await Promise.all([
            Message.deleteMany({ conversationId }),
            Conversation.findByIdAndDelete(conversationId)
        ]);

        await delCache(...participants.map(p => `convs:${p}`), `msgs:${participants.sort().join(':')}`);

        res.json({ message: 'Chat deleted' });
    } catch (err) {
        console.error('[Conversation] Delete error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

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

        const query = { conversationId: conversation._id, deletedAt: null };
        if (before) query.createdAt = { $lt: new Date(before) };

        const messages = await Message.find(query).sort({ createdAt: -1 }).limit(limit).lean();
        messages.reverse();

        const result = { messages, conversation, hasMore: messages.length === limit };
        await setCache(cacheKey, result, 15);
        res.status(200).json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── SEARCH MESSAGES (PROTECTED) ──────────────────────────────────────────────
router.get('/messages/search', verifyToken, async (req, res) => {
    try {
        const { conversationId, q } = req.query;
        const userId = req.userId;
        if (!conversationId || !q) return res.status(400).json({ error: 'Required fields missing' });

        const conv = await Conversation.findOne({ _id: conversationId, 'participants.userId': userId });
        if (!conv) return res.status(403).json({ error: 'Unauthorized' });

        const messages = await Message.find({
            conversationId, deletedAt: null,
            $text: { $search: q },
        }).sort({ score: { $meta: 'textScore' } }).limit(20).lean();

        res.json(messages);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── SEND MESSAGE (PROTECTED) ─────────────────────────────────────────────────
router.post(['/messages/create', '/send'], verifyToken, async (req, res) => {
    try {
        const { conversationId, senderName, content, recipientId, mediaUrl, mediaType, mediaName, mediaSize, storyReply, sharedPost } = req.body;
        const sender = req.userId;
        const conv = await Conversation.findOne({ _id: conversationId, 'participants.userId': sender });
        if (!conv) return res.status(403).json({ error: 'Unauthorized to send message to this conversation' });

        const message = await Message.create({
            conversationId, sender, content: content || '',
            media: mediaUrl ? { url: mediaUrl, type: mediaType, name: mediaName, size: mediaSize } : {},
            storyReply: storyReply || undefined,
            sharedPost: sharedPost || undefined,
        });

        await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: { id: message._id, message: content || `📎 ${mediaType || 'file'}`, isRead: false },
            lastMessageAt: new Date(), lastMessageBy: sender,
        });

        const senderUser = await User.findById(sender).select('fullname profile_picture').lean();
        const notification = await Notification.create({
            recipient: recipientId,
            sender: { id: sender, fullname: senderName || senderUser?.fullname || 'Someone', profile_picture: senderUser?.profile_picture || '' },
            message: { id: message._id, content: content || `Sent a ${mediaType || 'file'}` },
        });

        await delCache(`convs:${sender}`, `convs:${recipientId}`, `msgs:${[sender, recipientId].sort().join(':')}`);

        if (_io) {
            _io.to(recipientId).to(sender).emit('receiveMessage', { ...message.toObject(), senderId: sender, senderName: senderName || senderUser?.fullname });
            _io.to(recipientId).emit('newNotification', notification);
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
        if (!message || message.sender.toString() !== userId) return res.status(403).json({ error: 'Unauthorized' });

        message.content = content; message.edited = true; message.editedAt = new Date();
        await message.save();

        // Update last message in conversation if this was the latest one
        const conv = await Conversation.findById(message.conversationId);
        if (conv && conv.lastMessage && conv.lastMessage.id?.toString() === message._id.toString()) {
            await Conversation.findByIdAndUpdate(message.conversationId, {
                'lastMessage.message': content || '📎 Media'
            });
        }

        // Clear Cache to ensure persistence on refresh
        const participants = conv.participants.map(p => p.userId.toString());
        await delCache(
            ...participants.map(p => `convs:${p}`),
            `msgs:${participants.sort().join(':')}`
        );

        if (_io) {
            conv?.participants?.forEach(p => _io.to(p.userId.toString()).emit('messageEdited', {
                messageId: message._id,
                content,
                conversationId: message.conversationId
            }));
        }
        res.json(message);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── DELETE MESSAGE (PROTECTED) ────────────────────────────────────────────────
router.delete('/messages/:messageId', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const message = await Message.findOne({ _id: req.params.messageId, sender: userId });
        if (!message) return res.status(404).json({ error: 'Not found' });

        message.deletedAt = new Date(); message.content = '';
        await message.save();

        // Update last message in conversation if this was the latest one
        const conv = await Conversation.findById(message.conversationId);
        if (conv && conv.lastMessage && conv.lastMessage.id?.toString() === message._id.toString()) {
            await Conversation.findByIdAndUpdate(message.conversationId, {
                'lastMessage.message': '🚫 Message deleted'
            });
        }

        // Clear Cache to ensure persistence on refresh
        const participants = conv.participants.map(p => p.userId.toString());
        await delCache(
            ...participants.map(p => `convs:${p}`),
            `msgs:${participants.sort().join(':')}`
        );

        if (_io) {
            conv?.participants?.forEach(p => _io.to(p.userId.toString()).emit('messageDeleted', {
                messageId: message._id,
                conversationId: message.conversationId
            }));
        }
        res.json({ message: 'Deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── MARK MESSAGES READ (PROTECTED) ───────────────────────────────────────────
router.post('/messages/mark-read', verifyToken, async (req, res) => {
    try {
        const { unreadMessageIds, lastMessage } = req.body;
        const userId = req.userId;
        await Message.updateMany({ _id: { $in: unreadMessageIds } }, { $set: { isRead: true } });
        if (lastMessage) {
            const msg = await Message.findById(lastMessage).lean();
            if (msg) {
                await Conversation.findByIdAndUpdate(msg.conversationId, { 'lastMessage.isRead': true });
                await delCache(`convs:${msg.sender}`);
            }
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── NOTIFICATIONS (PROTECTED) ────────────────────────────────────────────────
router.get('/notifications', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const notifications = await Notification.find({ recipient: userId }).sort({ createdAt: -1 }).limit(50).lean();
        res.json({ notifications, total: notifications.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/notifications/mark-read', verifyToken, async (req, res) => {
    try {
        const { Ids } = req.body;
        await Notification.updateMany({ _id: { $in: Ids }, recipient: req.userId }, { $set: { read: true } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── BACKWARD-COMPAT: FETCH CONVERSATIONS BY USER ID (PROTECTED) ───────────
router.get('/:participantId', verifyToken, async (req, res) => {
    try {
        const { participantId } = req.params;
        if (participantId !== req.userId) return res.status(403).json({ error: 'Unauthorized' });

        const conversations = await Conversation.find({ 'participants.userId': req.userId }).sort({ lastMessageAt: -1 }).lean();
        res.json(conversations);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.setIo = setIo;
module.exports = router;
