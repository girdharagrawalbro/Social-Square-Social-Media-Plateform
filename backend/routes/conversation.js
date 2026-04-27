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
    if (redis.status === 'disabled') return null;
    try { const v = await redis.get(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
async function setCache(key, data, ttl = CACHE_TTL) {
    if (redis.status === 'disabled') return;
    try { await redis.set(key, JSON.stringify(data), 'EX', ttl); } catch { }
}
async function delCache(...keys) {
    if (redis.status === 'disabled') return;
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
            User.findById(recipientId).select('fullname profile_picture isPrivate followers').lean(),
        ]);

        if (!senderUser || !recipientUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 🔒 Privacy Guard: If recipient is private, sender must be a follower
        if (recipientUser.isPrivate) {
            const isFollower = (recipientUser.followers || []).some(id => id.toString() === senderId.toString());
            if (!isFollower) {
                return res.status(403).json({ error: 'This account is private. Follow to start a conversation.' });
            }
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
        const { recipientId, before, limit = 20, targetDate } = req.body;
        const senderId = req.userId;
        if (recipientId === senderId) return res.status(400).json({ error: 'Cannot message yourself' });

        const recipient = await User.findById(recipientId).select('fullname username profile_picture isPrivate followers').lean();
        if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

        // 🔒 Privacy Guard: If recipient is private, sender must be a follower
        if (recipient.isPrivate) {
            const isFollower = (recipient.followers || []).some(id => id.toString() === senderId.toString());
            if (!isFollower) {
                return res.status(403).json({ error: 'This account is private. Follow to message.' });
            }
        }

        // Check if exists
        let conversation = await Conversation.findOne({ 'participants.userId': { $all: [senderId, recipientId] } }).lean();
        if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

        const cacheKey = `msgs:${conversation._id}:${before || 'latest'}:${limit}:${targetDate || 'none'}`;
        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const query = { conversationId: conversation._id };
        if (before) query.createdAt = { $lt: new Date(before) };

        let customLimit = parseInt(limit);
        if (targetDate) {
            const countQuery = { conversationId: conversation._id };
            countQuery.createdAt = { $gte: new Date(targetDate) };
            if (before) countQuery.createdAt.$lt = new Date(before);
            
            const count = await Message.countDocuments(countQuery);
            customLimit = Math.max(customLimit, count + 30);
        }

        const messages = await Message.find(query)
            .sort({ createdAt: -1 })
            .limit(customLimit)
            .populate({
                path: 'replyTo',
                select: 'content media sender',
                populate: { path: 'sender', select: 'fullname' }
            })
            .lean();

        const sanitizedMessages = messages.map(m => {
            if (m.deletedAt) {
                return {
                    ...m,
                    content: '🚫 Message deleted',
                    media: null,
                    voiceNote: null,
                    replyTo: null,
                    reactions: {},
                    storyReply: null,
                    sharedPost: null
                };
            }
            return m;
        });
        sanitizedMessages.reverse();

        const result = { messages: sanitizedMessages, conversation, hasMore: messages.length === limit };
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
        })
        .sort({ score: { $meta: 'textScore' } })
        .limit(20)
        .populate({
            path: 'replyTo',
            select: 'content media sender',
            populate: { path: 'sender', select: 'fullname' }
        })
        .lean();

        res.json(messages);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── SEND MESSAGE (PROTECTED) ─────────────────────────────────────────────────
router.post(['/messages/create', '/send'], verifyToken, async (req, res) => {
    try {
        const { conversationId, senderName, content, recipientId, mediaUrl, mediaType, mediaName, mediaSize, storyReply, sharedPost, replyTo } = req.body;
        const sender = req.userId;
        
        let conv;
        if (conversationId) {
            conv = await Conversation.findOne({ _id: conversationId, 'participants.userId': sender });
        } else if (recipientId) {
            // Find or create conversation by recipientId
            const participantIds = [sender, recipientId];
            conv = await Conversation.findOne({ 'participants.userId': { $all: participantIds } });
            
            if (!conv) {
                const [senderUser, recipientUser] = await Promise.all([
                    User.findById(sender).select('fullname profile_picture').lean(),
                    User.findById(recipientId).select('fullname profile_picture isPrivate followers').lean(),
                ]);
                if (!senderUser || !recipientUser) return res.status(404).json({ error: 'User not found' });

                // 🔒 Privacy Guard: If recipient is private, sender must be a follower
                if (recipientUser.isPrivate) {
                    const isFollower = (recipientUser.followers || []).some(id => id.toString() === sender.toString());
                    if (!isFollower) {
                        return res.status(403).json({ error: 'This account is private. Follow to message.' });
                    }
                }
                
                conv = await Conversation.create({
                    participants: [
                        { userId: sender, fullname: senderUser.fullname, profilePicture: senderUser.profile_picture || '' },
                        { userId: recipientId, fullname: recipientUser.fullname, profilePicture: recipientUser.profile_picture || '' },
                    ]
                });
            }
        }

        if (!conv) return res.status(403).json({ error: 'Unauthorized or missing conversation/recipient' });

        // Double check privacy even if conv exists (in case they unfollowed)
        const otherParticipant = conv.participants.find(p => p.userId.toString() !== sender.toString());
        if (otherParticipant) {
            const recipientUser = await User.findById(otherParticipant.userId).select('isPrivate followers').lean();
            if (recipientUser && recipientUser.isPrivate) {
                const isFollower = (recipientUser.followers || []).some(id => id.toString() === sender.toString());
                if (!isFollower) {
                    return res.status(403).json({ error: 'This account is private. Follow to message.' });
                }
            }
        }

        let message = await Message.create({
            conversationId: conv._id,
            sender,
            content: content || '',
            media: mediaUrl ? { url: mediaUrl, type: mediaType, name: mediaName, size: mediaSize } : {},
            storyReply: storyReply || undefined,
            sharedPost: sharedPost || undefined,
            replyTo: replyTo || null,
        });

        // Populate replyTo for the response
        if (message.replyTo) {
            message = await message.populate({
                path: 'replyTo',
                select: 'content media sender',
                populate: { path: 'sender', select: 'fullname' }
            });
        }

        const updatedConv = await Conversation.findByIdAndUpdate(conv._id, {
            lastMessage: { 
                id: message._id, 
                message: content || `📎 ${mediaType || 'file'}`, 
                isRead: false,
                isReply: !!message.replyTo
            },
            lastMessageAt: new Date(), lastMessageBy: sender,
        }, { new: true }).lean();

        const senderUser = await User.findById(sender).select('fullname profile_picture').lean();
        const notification = await Notification.create({
            recipient: recipientId,
            sender: { id: sender, fullname: senderName || senderUser?.fullname || 'Someone', profile_picture: senderUser?.profile_picture || '' },
            message: { id: message._id, content: content || `Sent a ${mediaType || 'file'}` },
        });

        // Robust cache clearing
        const participants = updatedConv.participants.map(p => p.userId.toString());
        await delCache(...participants.map(p => `convs:${p}`), `msgs:${conversationId}*`);

        if (_io) {
            const msgObj = { ...message.toObject(), senderId: sender, senderName: senderName || senderUser?.fullname };
            _io.to(recipientId).to(sender).emit('receiveMessage', msgObj);
            _io.to(recipientId).to(sender).emit('conversationUpdated', updatedConv);
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

        if (!message.originalContent) {
            message.originalContent = message.content;
        }
        message.content = content; 
        message.edited = true; 
        message.editedAt = new Date();
        await message.save();

        let updatedConv = null;
        const conv = await Conversation.findById(message.conversationId);
        if (conv && conv.lastMessage && conv.lastMessage.id?.toString() === message._id.toString()) {
            updatedConv = await Conversation.findByIdAndUpdate(message.conversationId, {
                'lastMessage.message': content || '📎 Media'
            }, { new: true }).lean();
        }

        // Robust cache clearing
        const participants = conv.participants.map(p => p.userId.toString());
        await delCache(...participants.map(p => `convs:${p}`), `msgs:${message.conversationId}*`);

        if (_io) {
            participants.forEach(p => {
                _io.to(p).emit('messageEdited', { messageId: message._id, content, conversationId: message.conversationId });
                if (updatedConv) _io.to(p).emit('conversationUpdated', updatedConv);
            });
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

        message.deletedAt = new Date();
        await message.save();

        let updatedConv = null;
        const conv = await Conversation.findById(message.conversationId);
        if (conv && conv.lastMessage && conv.lastMessage.id?.toString() === message._id.toString()) {
            updatedConv = await Conversation.findByIdAndUpdate(message.conversationId, {
                'lastMessage.message': '🚫 Message deleted'
            }, { new: true }).lean();
        }

        // Robust cache clearing
        const participants = conv.participants.map(p => p.userId.toString());
        await delCache(...participants.map(p => `convs:${p}`), `msgs:${message.conversationId}*`);

        if (_io) {
            participants.forEach(p => {
                _io.to(p).emit('messageDeleted', { messageId: message._id, conversationId: message.conversationId });
                if (updatedConv) _io.to(p).emit('conversationUpdated', updatedConv);
            });
        }
        res.json({ message: 'Deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── MARK MESSAGES READ (PROTECTED) ───────────────────────────────────────────
router.post('/messages/mark-read', verifyToken, async (req, res) => {
    try {
        let { unreadMessageIds, lastMessage } = req.body;
        const userId = req.userId;

        // Sanitize: ensure unreadMessageIds is an array of valid ObjectIds
        if (!Array.isArray(unreadMessageIds)) unreadMessageIds = [];
        const validMessageIds = unreadMessageIds.filter(id => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id));

        if (validMessageIds.length > 0) {
            await Message.updateMany({ _id: { $in: validMessageIds } }, { $set: { isRead: true } });
        }

        if (lastMessage && mongoose.Types.ObjectId.isValid(lastMessage)) {
            const msg = await Message.findById(lastMessage).lean();
            if (msg) {
                await Conversation.findByIdAndUpdate(msg.conversationId, { 'lastMessage.isRead': true });
                // Clear cache for both sender (to update seen status) and receiver (to update unread count)
                await delCache(`convs:${msg.sender}`, `convs:${userId}`);
            }
        }
        res.json({ success: true });
    } catch (err) { 
        console.error('[Conversation] Mark read error:', err.message);
        res.status(500).json({ error: err.message }); 
    }
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

// ─── UNREAD TOTAL (PROTECTED) ────────────────────────────────────────────────
router.get('/unread-total', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        // Find conversations where last message is unread AND was NOT sent by current user
        const conversations = await Conversation.find({ 
            'participants.userId': userId,
            'lastMessage.isRead': false,
            lastMessageBy: { $ne: userId }
        });
        res.json({ total: conversations.length });
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
