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
const { body, param, query, validationResult } = require('express-validator');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
};

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
    try {
        const flatKeys = Array.isArray(keys[0]) ? keys[0] : keys;
        const keysToDelete = [];
        for (const k of flatKeys) {
            if (k.endsWith('*')) {
                const found = await redis.keys(k);
                if (found && found.length) {
                    keysToDelete.push(...found);
                }
            } else {
                keysToDelete.push(k);
            }
        }
        if (keysToDelete.length) {
            await redis.del(keysToDelete);
        }
    } catch (e) {
        console.error('[Redis Cache Delete Error]:', e);
    }
}

let _io;
function setIo(io) { _io = io; }

// ─── CLEAR CHAT (PROTECTED) ──────────────────────────────────────────────────
router.delete('/:conversationId/clear', verifyToken, [
    param('conversationId').isMongoId().withMessage('Invalid conversation ID'),
    validate
], async (req, res) => {
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
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── DELETE CHAT (PROTECTED) ─────────────────────────────────────────────────
router.delete('/:conversationId', verifyToken, [
    param('conversationId').isMongoId().withMessage('Invalid conversation ID'),
    validate
], async (req, res) => {
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
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── CREATE CONVERSATION (PROTECTED) ──────────────────────────────────────────
router.post('/create', verifyToken, [
    body('recipientId').isMongoId().withMessage('Invalid recipient ID'),
    validate
], async (req, res) => {
    try {
        const { recipientId } = req.body;
        const senderId = req.userId;
        if (!recipientId) return res.status(400).json({ error: 'Recipient ID required' });

        const existing = await Conversation.findOne({
            'participants.userId': {
                $all: [
                    new mongoose.Types.ObjectId(senderId),
                    new mongoose.Types.ObjectId(recipientId)
                ]
            }
        }).lean();
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
    } catch (err) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── CREATE GROUP CONVERSATION (PROTECTED) ───────────────────────────────────
router.post('/group/create', verifyToken, [
    body('name').notEmpty().trim().escape().withMessage('Group name is required'),
    body('participantIds').isArray({ min: 1 }).withMessage('At least one other participant is required'),
    body('groupAvatar').optional().isURL().withMessage('Invalid avatar URL'),
    validate
], async (req, res) => {
    try {
        const { name, participantIds, groupAvatar } = req.body;
        const senderId = req.userId;

        // Fetch users details for all participants (including sender)
        const uniqueIds = Array.from(new Set([senderId, ...participantIds]));
        const users = await User.find({ _id: { $in: uniqueIds } }).select('fullname profile_picture').lean();

        if (users.length !== uniqueIds.length) {
            return res.status(404).json({ error: 'One or more users not found' });
        }

        const participants = users.map(u => ({
            userId: u._id,
            fullname: u.fullname,
            profilePicture: u.profile_picture || ''
        }));

        const conversation = await Conversation.create({
            isGroup: true,
            groupName: name,
            groupAvatar: groupAvatar || '',
            groupCreator: senderId,
            groupAdmins: [senderId],
            participants,
            lastMessageAt: new Date(),
            lastMessage: {
                message: 'Group created',
                isRead: false
            }
        });

        const sysMsg = await Message.create({
            conversationId: conversation._id,
            sender: senderId,
            content: 'Group created',
            isSystem: true
        });

        // Clear cached conversation lists for all participants
        await delCache(...uniqueIds.map(id => `convs:${id}`));

        if (_io) {
            uniqueIds.forEach(id => {
                const strId = id.toString();
                _io.to(strId).emit('conversationUpdated', conversation.toObject());
                _io.to(strId).emit('receiveMessage', sysMsg.toObject());
            });
        }

        res.status(201).json(conversation);
    } catch (err) {
        console.error('[Conversation] Create group error:', err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── ADD MEMBERS TO GROUP (PROTECTED) ────────────────────────────────────────
router.post('/group/:id/add-members', verifyToken, [
    param('id').isMongoId().withMessage('Invalid conversation ID'),
    body('memberIds').isArray({ min: 1 }).withMessage('At least one member ID is required'),
    validate
], async (req, res) => {
    try {
        const { id } = req.params;
        const { memberIds } = req.body;
        const senderId = req.userId;

        const conv = await Conversation.findById(id);
        if (!conv || !conv.isGroup) {
            return res.status(404).json({ error: 'Group conversation not found' });
        }

        // Check if sender is an admin
        const isAdmin = conv.groupAdmins.some(a => a.toString() === senderId.toString());
        if (!isAdmin) {
            return res.status(403).json({ error: 'Only admins can add members' });
        }

        // Fetch users details
        const users = await User.find({ _id: { $in: memberIds } }).select('fullname profile_picture').lean();
        const existingMemberIds = conv.participants.map(p => p.userId.toString());

        const newParticipants = users
            .filter(u => !existingMemberIds.includes(u._id.toString()))
            .map(u => ({
                userId: u._id,
                fullname: u.fullname,
                profilePicture: u.profile_picture || ''
            }));

        if (newParticipants.length === 0) {
            return res.status(400).json({ error: 'All specified users are already members' });
        }

        conv.participants.push(...newParticipants);
        conv.lastMessageAt = new Date();
        const contentStr = `${newParticipants.map(p => p.fullname).join(', ')} added to the group`;
        conv.lastMessage = {
            message: contentStr,
            isRead: false
        };
        await conv.save();

        const sysMsg = await Message.create({
            conversationId: conv._id,
            sender: senderId,
            content: contentStr,
            isSystem: true
        });

        const allMemberIds = conv.participants.map(p => p.userId.toString());
        await delCache(...allMemberIds.map(id => `convs:${id}`));

        if (_io) {
            allMemberIds.forEach(id => {
                _io.to(id).emit('conversationUpdated', conv.toObject());
                _io.to(id).emit('receiveMessage', sysMsg.toObject());
            });
        }

        res.json(conv);
    } catch (err) {
        console.error('[Conversation] Add members error:', err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── REMOVE MEMBERS FROM GROUP (PROTECTED) ───────────────────────────────────
router.post('/group/:id/remove-members', verifyToken, [
    param('id').isMongoId().withMessage('Invalid conversation ID'),
    body('memberIds').isArray({ min: 1 }).withMessage('At least one member ID is required'),
    validate
], async (req, res) => {
    try {
        const { id } = req.params;
        const { memberIds } = req.body;
        const senderId = req.userId;

        const conv = await Conversation.findById(id);
        if (!conv || !conv.isGroup) {
            return res.status(404).json({ error: 'Group conversation not found' });
        }

        // Check if sender is an admin
        const isAdmin = conv.groupAdmins.some(a => a.toString() === senderId.toString());
        if (!isAdmin) {
            return res.status(403).json({ error: 'Only admins can remove members' });
        }

        // Prevent removing the creator
        if (conv.groupCreator && memberIds.includes(conv.groupCreator.toString())) {
            return res.status(400).json({ error: 'Cannot remove the group creator' });
        }

        const removedUsers = conv.participants.filter(p => memberIds.includes(p.userId.toString()));
        conv.participants = conv.participants.filter(p => !memberIds.includes(p.userId.toString()));

        // Also clean up admin list if they were an admin
        conv.groupAdmins = conv.groupAdmins.filter(a => !memberIds.includes(a.toString()));

        conv.lastMessageAt = new Date();
        const contentStr = `${removedUsers.map(p => p.fullname).join(', ')} removed from the group`;
        conv.lastMessage = {
            message: contentStr,
            isRead: false
        };
        await conv.save();

        const sysMsg = await Message.create({
            conversationId: conv._id,
            sender: senderId,
            content: contentStr,
            isSystem: true
        });

        const allUserIds = [...conv.participants.map(p => p.userId.toString()), ...memberIds];
        await delCache(...allUserIds.map(id => `convs:${id}`));

        if (_io) {
            allUserIds.forEach(id => {
                _io.to(id).emit('conversationUpdated', conv.toObject());
                _io.to(id).emit('receiveMessage', sysMsg.toObject());
            });
        }

        res.json(conv);
    } catch (err) {
        console.error('[Conversation] Remove members error:', err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── LEAVE GROUP (PROTECTED) ─────────────────────────────────────────────────
router.post('/group/:id/leave', verifyToken, [
    param('id').isMongoId().withMessage('Invalid conversation ID'),
    validate
], async (req, res) => {
    try {
        const { id } = req.params;
        const senderId = req.userId;

        const conv = await Conversation.findById(id);
        if (!conv || !conv.isGroup) {
            return res.status(404).json({ error: 'Group conversation not found' });
        }

        const isMember = conv.participants.some(p => p.userId.toString() === senderId.toString());
        if (!isMember) {
            return res.status(400).json({ error: 'You are not a member of this group' });
        }

        const leaver = conv.participants.find(p => p.userId.toString() === senderId.toString());
        conv.participants = conv.participants.filter(p => p.userId.toString() !== senderId.toString());
        conv.groupAdmins = conv.groupAdmins.filter(a => a.toString() !== senderId.toString());

        // Assign a new admin if the leaver was the only admin and there are members left
        if (conv.groupAdmins.length === 0 && conv.participants.length > 0) {
            conv.groupAdmins.push(conv.participants[0].userId);
        }

        conv.lastMessageAt = new Date();
        const contentStr = `${leaver.fullname} left the group`;
        conv.lastMessage = {
            message: contentStr,
            isRead: false
        };
        await conv.save();

        const sysMsg = await Message.create({
            conversationId: conv._id,
            sender: senderId,
            content: contentStr,
            isSystem: true
        });

        const notifyIds = [...conv.participants.map(p => p.userId.toString()), senderId];
        await delCache(...notifyIds.map(id => `convs:${id}`));

        if (_io) {
            notifyIds.forEach(id => {
                _io.to(id).emit('conversationUpdated', conv.toObject());
                _io.to(id).emit('receiveMessage', sysMsg.toObject());
            });
        }

        res.json({ message: 'Successfully left the group' });
    } catch (err) {
        console.error('[Conversation] Leave group error:', err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── UPDATE GROUP DETAILS (PROTECTED) ────────────────────────────────────────
router.patch('/group/:id/update', verifyToken, [
    param('id').isMongoId().withMessage('Invalid conversation ID'),
    body('name').optional().notEmpty().trim().escape().withMessage('Group name cannot be empty'),
    body('groupAvatar').optional().isURL().withMessage('Invalid avatar URL'),
    validate
], async (req, res) => {
    try {
        const { id } = req.params;
        const { name, groupAvatar } = req.body;
        const senderId = req.userId;

        const conv = await Conversation.findById(id);
        if (!conv || !conv.isGroup) {
            return res.status(404).json({ error: 'Group conversation not found' });
        }

        // Check if sender is an admin
        const isAdmin = conv.groupAdmins.some(a => a.toString() === senderId.toString());
        if (!isAdmin) {
            return res.status(403).json({ error: 'Only admins can update group details' });
        }

        if (name) {
            conv.groupName = name;
        }
        if (groupAvatar !== undefined) {
            conv.groupAvatar = groupAvatar;
        }

        conv.lastMessageAt = new Date();
        const updateStr = name ? `Group name changed to "${name}"` : 'Group details updated';
        conv.lastMessage = {
            message: updateStr,
            isRead: false
        };
        await conv.save();

        const sysMsg = await Message.create({
            conversationId: conv._id,
            sender: senderId,
            content: updateStr,
            isSystem: true
        });

        const allMemberIds = conv.participants.map(p => p.userId.toString());
        await delCache(...allMemberIds.map(id => `convs:${id}`));

        if (_io) {
            allMemberIds.forEach(id => {
                _io.to(id).emit('conversationUpdated', conv.toObject());
                _io.to(id).emit('receiveMessage', sysMsg.toObject());
            });
        }

        res.json(conv);
    } catch (err) {
        console.error('[Conversation] Update group details error:', err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


// ─── FETCH CONVERSATIONS (PROTECTED) ──────────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { cursor, limit = 20 } = req.query;

        const query = { 'participants.userId': userId };
        if (cursor) {
            query.lastMessageAt = { $lt: new Date(cursor) };
        }

        const conversations = await Conversation.find(query)
            .sort({ lastMessageAt: -1 })
            .limit(parseInt(limit))
            .lean();

        const nextCursor = conversations.length === parseInt(limit)
            ? conversations[conversations.length - 1].lastMessageAt
            : null;

        res.status(200).json({
            conversations,
            nextCursor
        });
    } catch (err) {
        console.error('[Conversation] Fetch error:', err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── SEARCH CONVERSATIONS (PROTECTED) ──────────────────────────────────────────
router.get('/search', verifyToken, [
    query('q').notEmpty().trim().escape().withMessage('Search query required'),
    validate
], async (req, res) => {
    try {
        const userId = req.userId;
        const { q } = req.query;
        if (!q) return res.status(400).json({ error: 'Query required' });

        // Search for conversations where at least one participant (other than the user) matches the query
        const conversations = await Conversation.find({
            'participants.userId': userId,
            'participants': {
                $elemMatch: {
                    userId: { $ne: userId },
                    fullname: { $regex: q, $options: 'i' }
                }
            }
        })
            .sort({ lastMessageAt: -1 })
            .limit(20)
            .lean();

        res.json(conversations);
    } catch (err) {
        console.error('[Conversation] Search error:', err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── FETCH MESSAGES (PROTECTED) ───────────────────────────────────────────────
router.post('/messages', verifyToken, [
    body('recipientId').optional().isMongoId().withMessage('Invalid recipient ID'),
    body('conversationId').optional().isMongoId().withMessage('Invalid conversation ID'),
    body('before').optional().isISO8601(),
    body('limit').optional().isInt({ min: 1, max: 100 }),
    validate
], async (req, res) => {
    try {
        const { recipientId, conversationId, before, limit = 20, targetDate } = req.body;
        const senderId = req.userId;

        if (!recipientId && !conversationId) {
            return res.status(400).json({ error: 'recipientId or conversationId is required' });
        }

        let conversation;
        const senderObjId = new mongoose.Types.ObjectId(senderId);
        if (conversationId) {
            conversation = await Conversation.findOne({ _id: conversationId, 'participants.userId': senderObjId }).lean();
        } else if (recipientId) {
            if (recipientId === senderId) return res.status(400).json({ error: 'Cannot message yourself' });
            const recipientObjId = new mongoose.Types.ObjectId(recipientId);

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
            conversation = await Conversation.findOne({ isGroup: false, 'participants.userId': { $all: [senderObjId, recipientObjId] } }).lean();
        }

        if (!conversation) {
            if (recipientId) {
                const recipient = await User.findById(recipientId).select('fullname username profile_picture').lean();
                if (recipient) {
                    const senderUser = await User.findById(senderId).select('fullname profile_picture').lean();
                    return res.status(200).json({
                        messages: [],
                        conversation: {
                            isGroup: false,
                            participants: [
                                { userId: senderId, fullname: senderUser?.fullname || '', profilePicture: senderUser?.profile_picture || '' },
                                { userId: recipientId, fullname: recipient.fullname, profilePicture: recipient.profile_picture || '' }
                            ]
                        },
                        hasMore: false
                    });
                }
            }
            return res.status(200).json({ messages: [], conversation: null, hasMore: false });
        }

        const cacheKey = `msgs:${conversation._id}:${before || 'latest'}:${limit}:${targetDate || 'none'}`;
        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const query = {
            conversationId: conversation._id,
            deletedFor: { $ne: req.userId }
        };
        if (before) query.createdAt = { $lt: new Date(before) };

        let customLimit = parseInt(limit);
        if (targetDate) {
            const countQuery = {
                conversationId: conversation._id,
                deletedFor: { $ne: req.userId },
                createdAt: { $gte: new Date(targetDate) }
            };
            if (before) countQuery.createdAt.$lt = new Date(before);

            const count = await Message.countDocuments(countQuery);
            customLimit = Math.max(customLimit, count + 30);
        }

        const messages = await Message.find(query)
            .sort({ createdAt: -1 })
            .limit(customLimit)
            .populate('sender', 'fullname profile_picture')
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
    } catch (err) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── SEARCH MESSAGES (PROTECTED) ──────────────────────────────────────────────
router.get('/messages/search', verifyToken, [
    query('conversationId').isMongoId().withMessage('Invalid conversation ID'),
    query('q').notEmpty().trim().escape(),
    validate
], async (req, res) => {
    try {
        const { conversationId, q } = req.query;
        const userId = req.userId;
        if (!conversationId || !q) return res.status(400).json({ error: 'Required fields missing' });

        const conv = await Conversation.findOne({ _id: conversationId, 'participants.userId': userId });
        if (!conv) return res.status(403).json({ error: 'Unauthorized' });

        const messages = await Message.find({
            conversationId, deletedAt: null,
            deletedFor: { $ne: req.userId },
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
    } catch (err) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── SEND MESSAGE (PROTECTED) ─────────────────────────────────────────────────
router.post(['/messages/create', '/send'], verifyToken, [
    body('conversationId').optional().isMongoId(),
    body('recipientId').optional().isMongoId(),
    body('content').optional().trim().escape(),
    body('mediaUrl').optional().custom((val) => {
        if (typeof val === 'string' && (val.startsWith('{"ciphertext":') || val.startsWith('http://') || val.startsWith('https://'))) {
            return true;
        }
        throw new Error('Invalid media URL');
    }),
    validate
], async (req, res) => {
    try {
        const { conversationId, senderName, content, recipientId, mediaUrl, mediaType, mediaName, mediaSize, storyReply, sharedPost, replyTo, thumbnailUrl } = req.body;
        const sender = req.userId;

        let conv;
        if (conversationId) {
            conv = await Conversation.findOne({ _id: conversationId, 'participants.userId': sender });
        } else if (recipientId) {
            // Find or create conversation by recipientId
            const participantIds = [sender, recipientId];
            conv = await Conversation.findOne({ 'participants.userId': { $all: participantIds }, isGroup: false });

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

        // Double check privacy even if conv exists (in case they unfollowed) - ONLY for direct conversations
        if (!conv.isGroup) {
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
        }

        let message = await Message.create({
            conversationId: conv._id,
            sender,
            content: content || '',
            media: mediaUrl ? { url: mediaUrl, type: mediaType, name: mediaName, size: mediaSize, thumbnailUrl } : {},
            storyReply: storyReply || undefined,
            sharedPost: sharedPost || undefined,
            replyTo: replyTo || null,
            isEncrypted: req.body.isEncrypted || false,
            encryptedKeys: req.body.encryptedKeys || undefined,
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
        const otherParticipants = conv.participants.filter(p => p.userId.toString() !== sender.toString());

        // Create notifications for all other members
        if (otherParticipants.length > 0) {
            await Promise.all(otherParticipants.map(p => {
                return Notification.create({
                    recipient: p.userId,
                    sender: { id: sender, fullname: senderName || senderUser?.fullname || 'Someone', profile_picture: senderUser?.profile_picture || '' },
                    message: { id: message._id, content: content || `Sent a ${mediaType || 'file'}` },
                });
            }));
        }

        // Robust cache clearing for all participants
        const participants = updatedConv.participants.map(p => p.userId.toString());
        await delCache(...participants.map(p => `convs:${p}`), `msgs:${conv._id}*`);

        if (_io) {
            const msgObj = { ...message.toObject(), senderId: sender, senderName: senderName || senderUser?.fullname };
            participants.forEach(p => {
                _io.to(p).emit('receiveMessage', msgObj);
                _io.to(p).emit('conversationUpdated', updatedConv);
            });
            otherParticipants.forEach(p => {
                _io.to(p.userId.toString()).emit('newNotification', {
                    recipient: p.userId,
                    sender: { id: sender, fullname: senderName || senderUser?.fullname || 'Someone', profile_picture: senderUser?.profile_picture || '' },
                    message: { id: message._id, content: content || `Sent a ${mediaType || 'file'}` },
                });
            });
        }

        // Trigger AI reply if it's a 1-on-1 chat and recipient is social_square_ai
        if (!conv.isGroup) {
            const aiParticipant = conv.participants.find(p => p.userId.toString() !== sender.toString());
            if (aiParticipant) {
                const aiUser = await User.findById(aiParticipant.userId).select('username fullname profile_picture').lean();
                if (aiUser && aiUser.username === 'social_square_ai') {
                    const aiChatService = require('../services/aiChatService');
                    aiChatService.triggerAiReply(conv._id, sender, content || '', aiUser).catch(err => {
                        console.error('[AI Reply Trigger Error]:', err);
                    });
                }
            }
        }

        res.status(201).json(message);
    } catch (err) {
        console.error('[Send Message Error]:', err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── EDIT MESSAGE (PROTECTED) ─────────────────────────────────────────────────
router.patch('/messages/:messageId', verifyToken, [
    param('messageId').isMongoId().withMessage('Invalid message ID'),
    body('content').notEmpty().trim().escape(),
    validate
], async (req, res) => {
    try {
        const { content } = req.body;
        const userId = req.userId;
        const message = await Message.findById(req.params.messageId);
        if (!message || message.sender.toString() !== userId.toString()) return res.status(403).json({ error: 'Unauthorized' });

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
    } catch (err) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── DELETE MESSAGE (PROTECTED) ────────────────────────────────────────────────
router.delete('/messages/:messageId', verifyToken, [
    param('messageId').isMongoId().withMessage('Invalid message ID'),
    validate
], async (req, res) => {
    try {
        const userId = req.userId;
        const mode = req.query.mode || req.body.mode || 'everyone';

        const message = await Message.findById(req.params.messageId);
        if (!message) return res.status(404).json({ error: 'Not found' });

        const conv = await Conversation.findById(message.conversationId);
        if (!conv) return res.status(404).json({ error: 'Conversation not found' });

        const isParticipant = conv.participants.some(p => p.userId.toString() === userId.toString());
        if (!isParticipant) return res.status(403).json({ error: 'Forbidden' });

        let updatedConv = null;
        if (mode === 'me') {
            if (!message.deletedFor) message.deletedFor = [];
            if (!message.deletedFor.includes(userId)) {
                message.deletedFor.push(userId);
            }
            await message.save();

            // Clear cache for this specific user
            await delCache(`convs:${userId}`, `msgs:${message.conversationId}*`);

            if (_io) {
                _io.to(userId).emit('messageDeleted', { messageId: message._id, conversationId: message.conversationId, mode: 'me' });
            }
        } else {
            // Delete for everyone
            if (message.sender.toString() !== userId.toString()) {
                return res.status(403).json({ error: 'Unauthorized to delete for everyone' });
            }

            message.deletedAt = new Date();
            await message.save();

            if (conv && conv.lastMessage && conv.lastMessage.id?.toString() === message._id.toString()) {
                updatedConv = await Conversation.findByIdAndUpdate(message.conversationId, {
                    'lastMessage.message': '🚫 Message deleted'
                }, { new: true }).lean();
            }

            // Clear cache for all participants
            const participants = conv.participants.map(p => p.userId.toString());
            await delCache(...participants.map(p => `convs:${p}`), `msgs:${message.conversationId}*`);

            if (_io) {
                participants.forEach(p => {
                    _io.to(p).emit('messageDeleted', { messageId: message._id, conversationId: message.conversationId, mode: 'everyone' });
                    if (updatedConv) _io.to(p).emit('conversationUpdated', updatedConv);
                });
            }
        }

        res.json({ message: 'Deleted' });
    } catch (err) {
        console.error('[Conversation] Delete error:', err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── MARK MESSAGES READ (PROTECTED) ───────────────────────────────────────────
router.post('/messages/mark-read', verifyToken, [
    body('unreadMessageIds').optional().isArray(),
    body('lastMessage').optional().isMongoId(),
    validate
], async (req, res) => {
    try {
        let { unreadMessageIds, lastMessage } = req.body;
        const userId = req.userId;

        // Sanitize: ensure unreadMessageIds is an array of valid ObjectIds
        if (!Array.isArray(unreadMessageIds)) unreadMessageIds = [];
        const validMessageIds = unreadMessageIds.filter(id => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id));

        if (validMessageIds.length > 0) {
            await Message.updateMany(
                { _id: { $in: validMessageIds } },
                { $set: { isRead: true }, $addToSet: { readBy: userId } }
            );

            // Real-time synchronization: Notify all participants of the conversation
            try {
                const firstMsg = await Message.findById(validMessageIds[0]).select('conversationId').lean();
                if (firstMsg && _io) {
                    const conv = await Conversation.findById(firstMsg.conversationId).select('participants').lean();
                    if (conv) {
                        conv.participants.forEach(p => {
                            _io.to(p.userId.toString()).emit('messagesReadSync', {
                                conversationId: conv._id,
                                messageIds: validMessageIds,
                                userId
                            });
                        });
                    }
                }
            } catch (err) {
                console.error('[Conversation] Error sending messagesReadSync socket:', err.message);
            }
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
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── NOTIFICATIONS (PROTECTED) ────────────────────────────────────────────────
router.get('/notifications/unread-count', verifyToken, async (req, res) => {
    try {
        const count = await Notification.countDocuments({ recipient: req.userId, read: false });
        res.json({ unreadCount: count });
    } catch (err) { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get('/notifications', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const notifications = await Notification.find({ recipient: userId }).sort({ createdAt: -1 }).limit(50).lean();
        res.json({ notifications, total: notifications.length });
    } catch (err) { res.status(500).json({ error: "Internal Server Error" }); }
});

router.patch('/notifications/mark-read', verifyToken, [
    body('Ids').isArray().withMessage('Ids must be an array'),
    body('Ids.*').isMongoId(),
    validate
], async (req, res) => {
    try {
        const { Ids } = req.body;
        await Notification.updateMany({ _id: { $in: Ids }, recipient: req.userId }, { $set: { read: true } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── UNREAD TOTAL (PROTECTED) ────────────────────────────────────────────────
router.get('/unread-total', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        // Find conversations where last message is unread AND was NOT sent by current user
        const total = await Conversation.countDocuments({
            'participants.userId': userId,
            'lastMessage.isRead': false,
            lastMessageBy: { $ne: userId }
        });
        res.json({ total });
    } catch (err) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── REACT TO MESSAGE (PROTECTED) ─────────────────────────────────────────────
router.post('/messages/:messageId/react', verifyToken, [
    param('messageId').isMongoId().withMessage('Invalid message ID'),
    body('emoji').notEmpty().trim().escape().withMessage('Emoji is required'),
    validate
], async (req, res) => {
    try {
        const { emoji } = req.body;
        const userId = req.userId;
        const message = await Message.findById(req.params.messageId);
        if (!message) return res.status(404).json({ error: 'Message not found' });

        if (!message.reactions) {
            message.reactions = new Map();
        }

        if (message.reactions.get(userId) === emoji) {
            message.reactions.delete(userId);
        } else {
            message.reactions.set(userId, emoji);
        }

        await message.save();

        const conv = await Conversation.findById(message.conversationId);
        const participants = conv.participants.map(p => p.userId.toString());
        await delCache(...participants.map(p => `convs:${p}`), `msgs:${message.conversationId}*`);

        const reactionsObj = Object.fromEntries(message.reactions);

        if (_io) {
            participants.forEach(p => {
                _io.to(p).emit('messageReaction', { messageId: message._id, conversationId: message.conversationId, reactions: reactionsObj });
            });
        }

        res.json({ messageId: message._id, reactions: reactionsObj });
    } catch (err) {
        console.error('[React Message Error]:', err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── GET MESSAGE INFO / SEEN DETAILS (PROTECTED) ──────────────────────────────
router.get('/messages/:messageId/info', verifyToken, [
    param('messageId').isMongoId().withMessage('Invalid message ID'),
    validate
], async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId)
            .populate('readBy', 'fullname profile_picture username')
            .populate('sender', 'fullname profile_picture')
            .lean();

        if (!message) return res.status(404).json({ error: 'Message not found' });

        const conv = await Conversation.findById(message.conversationId).lean();
        if (!conv) return res.status(404).json({ error: 'Conversation not found' });

        res.json({
            message,
            conversation: conv
        });
    } catch (err) {
        console.error('[Get Message Info Error]:', err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── BACKWARD-COMPAT: FETCH CONVERSATIONS BY USER ID (PROTECTED) ───────────
router.get('/:participantId', verifyToken, async (req, res) => {
    try {
        const { participantId } = req.params;
        if (participantId !== req.userId) return res.status(403).json({ error: 'Unauthorized' });

        const conversations = await Conversation.find({ 'participants.userId': req.userId }).sort({ lastMessageAt: -1 }).lean();
        res.json(conversations);
    } catch (err) { res.status(500).json({ error: "Internal Server Error" }); }
});

router.setIo = setIo;
module.exports = router;
