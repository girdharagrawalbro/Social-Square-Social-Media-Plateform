const express = require('express');
const router  = express.Router();
const Conversation = require('../models/Conversation');
const Message      = require('../models/Message');
const Notification = require('../models/Notification');
const { createClient } = require('redis');

// ─── REDIS CLIENT ─────────────────────────────────────────────────────────────
let redis;
(async () => {
    try {
        redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
        await redis.connect();
        console.log('[Redis] Conversation cache connected');
    } catch (err) {
        console.warn('[Redis] Cache not available:', err.message);
        redis = null;
    }
})();

const CACHE_TTL = 60; // 60 seconds

async function getCache(key) {
    if (!redis) return null;
    try { const v = await redis.get(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
async function setCache(key, data, ttl = CACHE_TTL) {
    if (!redis) return;
    try { await redis.setEx(key, ttl, JSON.stringify(data)); } catch {}
}
async function delCache(...keys) {
    if (!redis) return;
    try { await Promise.all(keys.map(k => redis.del(k))); } catch {}
}

let _io;
function setIo(io) { _io = io; }

// ─── CREATE CONVERSATION ──────────────────────────────────────────────────────
router.post('/create', async (req, res) => {
    try {
        const { participants } = req.body;
        if (!participants || participants.length !== 2)
            return res.status(400).json({ error: 'Exactly two participants required' });

        const participantIds = participants.map(p => p.userId);
        const existing = await Conversation.findOne({ 'participants.userId': { $all: participantIds } }).lean();
        if (existing) return res.status(200).json(existing);

        const conversation = await Conversation.create({ participants });

        // Invalidate both users' conversation cache
        await delCache(`convs:${participantIds[0]}`, `convs:${participantIds[1]}`);
        res.status(201).json(conversation);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── FETCH CONVERSATIONS ──────────────────────────────────────────────────────
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const cacheKey = `convs:${userId}`;

        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const conversations = await Conversation.find({ 'participants.userId': userId })
            .sort({ lastMessageAt: -1 })
            .lean();

        await setCache(cacheKey, conversations, 30); // shorter TTL — changes frequently
        res.status(200).json(conversations);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── FETCH MESSAGES ───────────────────────────────────────────────────────────
router.post('/messages', async (req, res) => {
    try {
        const { participantIds } = req.body;
        if (!participantIds || participantIds.length !== 2)
            return res.status(400).json({ error: 'Two participant IDs required' });

        const cacheKey = `msgs:${participantIds.sort().join(':')}`;
        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const conversation = await Conversation.findOne({ 'participants.userId': { $all: participantIds } }).lean();
        if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

        const messages = await Message.find({
            conversationId: conversation._id,
            deletedAt: null, // exclude soft-deleted
        }).sort({ createdAt: 1 }).lean();

        const result = { messages, conversation };
        await setCache(cacheKey, result, 15); // 15s TTL for messages
        res.status(200).json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── SEARCH MESSAGES ──────────────────────────────────────────────────────────
router.get('/messages/search', async (req, res) => {
    try {
        const { conversationId, q } = req.query;
        if (!conversationId || !q) return res.status(400).json({ error: 'conversationId and q required' });

        const messages = await Message.find({
            conversationId,
            deletedAt: null,
            $text: { $search: q },
        }).sort({ score: { $meta: 'textScore' } }).limit(20).lean();

        res.json(messages);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── SEND MESSAGE ─────────────────────────────────────────────────────────────
router.post('/messages/create', async (req, res) => {
    try {
        const { conversationId, sender, senderName, content, recipientId, mediaUrl, mediaType, mediaName, mediaSize } = req.body;
        if (!conversationId || !sender || !recipientId)
            return res.status(400).json({ error: 'Required fields missing' });

        const message = await Message.create({
            conversationId, sender, content: content || '',
            media: mediaUrl ? { url: mediaUrl, type: mediaType, name: mediaName, size: mediaSize } : {},
        });

        // Update conversation last message
        await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: { id: message._id, message: content || `📎 ${mediaType || 'file'}`, isRead: false },
            lastMessageAt: new Date(),
            lastMessageBy: sender,
        });

        // Notification
        await Notification.create({
            recipient: recipientId,
            sender: { id: sender, fullname: senderName },
            message: { id: message._id, content: content || `Sent a ${mediaType || 'file'}` },
        });

        // Invalidate cache
        await delCache(`convs:${sender}`, `convs:${recipientId}`, `msgs:${[sender, recipientId].sort().join(':')}`);

        // Emit via socket if io available
        if (_io) {
            _io.to(recipientId).emit('receiveMessage', {
                ...message.toObject(), senderId: sender, senderName,
            });
        }

        res.status(201).json(message);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── EDIT MESSAGE ─────────────────────────────────────────────────────────────
router.patch('/messages/:messageId', async (req, res) => {
    try {
        const { content } = req.body;
        const message = await Message.findByIdAndUpdate(
            req.params.messageId,
            { content, edited: true, editedAt: new Date() },
            { new: true }
        ).lean();
        if (!message) return res.status(404).json({ error: 'Message not found' });

        // Notify recipient via socket
        // Emit to both participants' rooms (they joined with their userId as room name)
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

// ─── DELETE MESSAGE (soft) ────────────────────────────────────────────────────
router.delete('/messages/:messageId', async (req, res) => {
    try {
        const { userId } = req.body;
        const message = await Message.findOne({ _id: req.params.messageId, sender: userId });
        if (!message) return res.status(404).json({ error: 'Message not found or unauthorized' });

        message.deletedAt = new Date();
        message.content   = '';
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

// ─── REACT TO MESSAGE ─────────────────────────────────────────────────────────
router.post('/messages/:messageId/react', async (req, res) => {
    try {
        const { userId, emoji } = req.body;
        const message = await Message.findById(req.params.messageId);
        if (!message) return res.status(404).json({ error: 'Not found' });

        if (message.reactions.get(userId) === emoji) {
            message.reactions.delete(userId); // toggle off same emoji
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

// ─── MARK READ ────────────────────────────────────────────────────────────────
router.post('/messages/mark-read', async (req, res) => {
    try {
        const { unreadMessageIds, lastMessage } = req.body;
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

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
router.get('/notifications/:userId', async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.params.userId, read: false })
            .sort({ createdAt: -1 }).lean();
        res.status(200).json(notifications);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/notifications/mark-read', async (req, res) => {
    try {
        const { Ids } = req.body;
        await Notification.updateMany({ _id: { $in: Ids } }, { $set: { read: true } });
        res.json({ Ids });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
module.exports.setIo = setIo;