const express = require('express');
const Story = require('../models/Story');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const notificationUtils = require('../lib/notification.js');
const verifyToken = require('../middleware/Verifytoken');
const router = express.Router();

let _io;
function setIo(io) { _io = io; }

// ─── CREATE STORY (PROTECTED) ─────────────────────────────────────────────────
router.post('/create', verifyToken, async (req, res) => {
    try {
        const { mediaUrl, mediaType, text, sharedPostId } = req.body;
        const userId = req.userId;
        if (!mediaUrl || !mediaType) return res.status(400).json({ message: 'Required fields missing.' });

        const user = await User.findById(userId).select('fullname profile_picture followers');
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const story = new Story({
            user: { _id: user._id, fullname: user.fullname, profile_picture: user.profile_picture },
            media: { url: mediaUrl, type: mediaType },
            text: text || {},
            sharedPostId: sharedPostId || null,
        });
        await story.save();

        if (_io && user.followers?.length > 0) {
            user.followers.forEach(followerId => {
                _io.to(followerId.toString()).emit('newStory', story);
            });
        }

        res.status(201).json(story);
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// ─── GET STORIES FEED (PROTECTED) ─────────────────────────────────────────────
router.get('/feed', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId).select('following');
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const userIds = [userId, ...user.following.map(id => id.toString())];
        const stories = await Story.find({
            'user._id': { $in: userIds },
            expiresAt: { $gt: new Date() },
        })
        .populate('sharedPostId')
        .sort({ createdAt: -1 });

        const grouped = {};
        stories.forEach(story => {
            const uid = story.user._id.toString();
            if (!grouped[uid]) {
                grouped[uid] = { user: story.user, stories: [], hasUnviewed: false };
            }
            grouped[uid].stories.push(story);
            if (!story.viewers.map(v => v.toString()).includes(userId)) {
                grouped[uid].hasUnviewed = true;
            }
        });

        const result = Object.values(grouped).sort((a, b) => {
            if (a.user._id.toString() === userId) return -1;
            if (b.user._id.toString() === userId) return 1;
            return b.hasUnviewed - a.hasUnviewed;
        });

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── MARK AS VIEWED (PROTECTED) ───────────────────────────────────────────────
router.post('/view/:storyId', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const story = await Story.findById(req.params.storyId);
        if (!story) return res.status(404).json({ message: 'Story not found.' });

        // Privacy check
        const owner = await User.findById(story.user._id).select('isPrivate followers');
        if (owner.isPrivate && owner._id.toString() !== userId && !owner.followers.includes(userId)) {
            return res.status(403).json({ message: 'This story is private.' });
        }

        await Story.findByIdAndUpdate(req.params.storyId, { $addToSet: { viewers: userId } });
        res.status(200).json({ message: 'Viewed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── GET VIEWERS (PROTECTED - OWNER ONLY) ─────────────────────────────────────
router.get('/viewers/:storyId', verifyToken, async (req, res) => {
    try {
        const story = await Story.findById(req.params.storyId)
            .populate('viewers', 'fullname profile_picture username');

        if (!story) return res.status(404).json({ message: 'Story not found.' });

        // Ownership check
        if (story.user._id.toString() !== req.userId) {
            return res.status(403).json({ message: 'Unauthorized to view story analytics.' });
        }

        res.status(200).json(story.viewers || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── LIKE/UNLIKE STORY (PROTECTED) ───────────────────────────────────────────
router.post('/like/:storyId', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const story = await Story.findById(req.params.storyId);
        if (!story) return res.status(404).json({ message: 'Story not found.' });

        const isLiked = (story.likes || []).some(id => id.toString() === userId);

        // Privacy check
        const owner = await User.findById(story.user._id).select('isPrivate followers');
        if (owner.isPrivate && owner._id.toString() !== userId && !owner.followers.includes(userId)) {
            return res.status(403).json({ message: 'This story is private.' });
        }

        if (isLiked) {
            story.likes = story.likes.filter(id => id.toString() !== userId.toString());
        } else {
            story.likes.push(userId);
        }
        await story.save();

        if (_io) {
            _io.emit('storyUpdate', { storyId: story._id, likes: story.likes });
        }

        // Create notification for story owner
        if (!isLiked) {
            const sender = await User.findById(userId).select('fullname profile_picture').lean();
            if (sender) {
                await notificationUtils.createNotification({
                    recipientId: story.user._id,
                    sender: { id: userId, fullname: sender.fullname, profile_picture: sender.profile_picture },
                    type: 'like',
                    thumbnail: story.media?.url,
                    url: `/stories?user=${story.user._id}`,
                });
            }
        }

        res.status(200).json(story);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── DELETE STORY (PROTECTED) ─────────────────────────────────────────────────
router.delete('/:storyId', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const story = await Story.findById(req.params.storyId);
        if (!story) return res.status(404).json({ message: 'Story not found.' });
        if (story.user._id.toString() !== userId) return res.status(403).json({ message: 'Unauthorized.' });
        await Story.findByIdAndDelete(req.params.storyId);
        res.status(200).json({ message: 'Story deleted.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── REPLY TO STORY (PROTECTED) ───────────────────────────────────────────────
router.post('/reply/:storyId', verifyToken, async (req, res) => {
    try {
        const textContent = text || req.body.content || '';

        // 1. Send Notification
        await notificationUtils.createNotification({
            recipientId: story.user._id,
            sender: { id: userId, fullname: sender.fullname, profile_picture: sender.profile_picture },
            type: 'message',
            thumbnail: story.media?.url,
            message: { content: `Replied: "${textContent}"` },
            url: `/stories?user=${story.user._id}`,
        });

        // 2. Create actual DM message
        let conversation = await Conversation.findOne({
            'participants.userId': { $all: [userId, story.user._id] }
        });

        if (!conversation) {
            const recipient = await User.findById(story.user._id).select('fullname profile_picture').lean();
            conversation = await Conversation.create({
                participants: [
                    { userId: userId, fullname: sender.fullname, profilePicture: sender.profile_picture || '' },
                    { userId: story.user._id, fullname: recipient.fullname, profilePicture: recipient.profile_picture || '' },
                ]
            });
        }

        const message = await Message.create({
            conversationId: conversation._id,
            sender: userId,
            content: textContent,
            storyReply: {
                storyId: story._id,
                mediaUrl: story.media?.url,
                mediaType: story.media?.type || 'image',
            }
        });

        // Update conversation
        await Conversation.findByIdAndUpdate(conversation._id, {
            lastMessage: textContent,
            lastMessageAt: new Date()
        });

        // 3. Emit real-time message if possible
        if (_io) {
            _io.to(story.user._id.toString()).emit('receiveMessage', {
                ...message.toObject(),
                senderName: sender.fullname
            });
        }

        res.status(200).json({ message: 'Reply sent' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
module.exports.setIo = setIo;