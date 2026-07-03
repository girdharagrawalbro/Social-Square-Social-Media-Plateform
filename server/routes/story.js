const express = require('express');
const mongoose = require('mongoose');
const Story = require('../models/Story');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const notificationUtils = require('../lib/notification.js');
const verifyToken = require('../middleware/Verifytoken');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
};

let _io;
function setIo(io) { _io = io; }

// ─── CREATE STORY (PROTECTED) ─────────────────────────────────────────────────
router.post('/create', verifyToken, [
    body('mediaUrl').isURL().withMessage('Invalid media URL'),
    body('mediaType').isIn(['image', 'video']).withMessage('Invalid media type'),
    body('sharedPostId').optional().isMongoId(),
    body('sharedStoryId').optional().isMongoId(),
    body('mentionIds').optional().isArray(),
    body('mentionIds.*').optional().isMongoId(),
    body('poll').optional().isObject(),
    body('music').optional().isObject(),
    validate
], async (req, res) => {
    try {
        const { mediaUrl, mediaType, text, sharedPostId, sharedStoryId, thumbnailUrl, mentionIds, visibility, poll, music } = req.body;
        const userId = req.userId;
        if (!mediaUrl || !mediaType) return res.status(400).json({ message: 'Required fields missing.' });

        const user = await User.findById(userId).select('username fullname profile_picture followers isOnline');
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const story = new Story({
            user: { _id: user._id, username: user.username, fullname: user.fullname, profile_picture: user.profile_picture, isOnline: user.isOnline },
            media: { url: mediaUrl, type: mediaType, thumbnailUrl: thumbnailUrl || null },
            text: text || {},
            sharedPostId: sharedPostId || null,
            sharedStoryId: sharedStoryId || null,
            mentions: mentionIds || [],
            visibility: visibility || 'public',
            poll: poll || undefined,
            music: music || undefined
        });
        await story.save();
        
        // Dispatch text-based mentions
        if (text && typeof text === 'object' && text.content) {
            const { handleMentions } = require('../services/mentionService');
            handleMentions(text.content, userId, null, null, `/stories?user=${userId}`).catch(err => {
                console.error('[Mentions Story Error]:', err.message);
            });
        }

        // Dispatch direct mention notifications
        if (Array.isArray(mentionIds) && mentionIds.length > 0) {
            mentionIds.forEach(async (mId) => {
                if (mId.toString() === userId.toString()) return;
                
                // Real-time socket emit
                if (_io) {
                    _io.to(mId.toString()).emit('newMention', { storyId: story._id, senderName: user.fullname });
                }

                // Persistent notification
                await notificationUtils.createNotification({
                    recipientId: mId,
                    sender: { id: user._id, fullname: user.fullname, profile_picture: user.profile_picture },
                    type: 'mention',
                    postId: null,
                    thumbnail: story.media?.url,
                    url: `/stories?user=${userId}`,
                    message: { content: 'tagged you in a story' }
                });
            });
        }

        if (_io && user.followers?.length > 0) {
            user.followers.forEach(followerId => {
                _io.to(followerId.toString()).emit('newStory', story);
            });
        }

        res.status(201).json(story);
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// ─── GET STORIES FEED (PROTECTED) ─────────────────────────────────────────────
router.get('/feed', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId).select('following');
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const userIds = [userId, ...user.following.map(id => id.toString())];

        // Find users who added this user to their closeFriends list
        const cfUsers = await User.find({ closeFriends: userId }).select('_id');
        const closeFriendOfIds = cfUsers.map(u => u._id.toString());

        const stories = await Story.find({
            'user._id': { $in: userIds },
            expiresAt: { $gt: new Date() },
            $or: [
                { visibility: 'public' },
                { visibility: { $exists: false } },
                { visibility: 'followers' },
                { visibility: 'close_friends', 'user._id': { $in: [...closeFriendOfIds.map(id => new mongoose.Types.ObjectId(id)), new mongoose.Types.ObjectId(userId)] } }
            ]
        })
            .populate({
                path: 'sharedPostId',
                populate: { path: 'user', select: 'fullname profile_picture isOnline' }
            })
            .populate('sharedStoryId')
            .populate('mentions', 'fullname username profile_picture')
            .sort({ createdAt: 1 });

        // Fetch fresh presence for all users in the feed
        const uniqueUserIds = [...new Set(stories.map(s => s.user._id.toString()))];
        const usersWithPresence = await User.find({ _id: { $in: uniqueUserIds } }).select('isOnline username fullname profile_picture');
        const presenceMap = {};
        usersWithPresence.forEach(u => presenceMap[u._id.toString()] = u);

        const grouped = {};
        stories.forEach(story => {
            const uid = story.user._id.toString();
            if (!grouped[uid]) {
                const freshUser = presenceMap[uid];
                grouped[uid] = {
                    user: {
                        _id: uid,
                        username: freshUser?.username || story.user.username,
                        fullname: freshUser?.fullname || story.user.fullname,
                        profile_picture: freshUser?.profile_picture || story.user.profile_picture,
                        isOnline: freshUser?.isOnline || false
                    },
                    stories: [],
                    hasUnviewed: false
                };
            }
            // 🔒 Privacy: Mask viewers and likes for non-owners
            const isOwner = uid === userId.toString();
            const sObj = story.toObject ? story.toObject() : story;

            sObj.viewersCount = (sObj.viewers || []).length;
            sObj.likesCount = (sObj.likes || []).length;
            sObj.isLiked = (sObj.likes || []).some(id => id.toString() === userId.toString());

            if (!isOwner) {
                sObj.viewers = []; // Hide identities
                sObj.likes = [];   // Hide identities
            }

            grouped[uid].stories.push(sObj);
            if (!story.viewers.map(v => v.toString()).includes(userId.toString())) {
                grouped[uid].hasUnviewed = true;
            }
        });

        const result = Object.values(grouped).sort((a, b) => {
            if (a.user._id.toString() === userId.toString()) return -1;
            if (b.user._id.toString() === userId.toString()) return 1;
            return b.hasUnviewed - a.hasUnviewed;
        });

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── MARK AS VIEWED (PROTECTED) ───────────────────────────────────────────────
router.post('/view/:storyId', verifyToken, [
    param('storyId').isMongoId().withMessage('Invalid story ID'),
    validate
], async (req, res) => {
    try {
        const userId = req.userId;
        const story = await Story.findById(req.params.storyId);
        if (!story) return res.status(404).json({ message: 'Story not found.' });

        // Privacy check
        const owner = await User.findById(story.user._id).select('isPrivate followers');
        if (owner.isPrivate && owner._id.toString() !== userId.toString() && !owner.followers.map(f => f.toString()).includes(userId.toString())) {
            return res.status(403).json({ message: 'This story is private.' });
        }

        await Story.findByIdAndUpdate(req.params.storyId, { $addToSet: { viewers: userId } });
        res.status(200).json({ message: 'Viewed' });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── GET VIEWERS (PROTECTED - OWNER ONLY) ─────────────────────────────────────
router.get('/viewers/:storyId', verifyToken, [
    param('storyId').isMongoId().withMessage('Invalid story ID'),
    validate
], async (req, res) => {
    try {
        const story = await Story.findById(req.params.storyId)
            .populate('viewers', 'fullname profile_picture username');

        if (!story) return res.status(404).json({ message: 'Story not found.' });

        // Ownership check
        if (story.user._id.toString() !== req.userId.toString()) {
            return res.status(403).json({ message: 'Unauthorized to view story analytics.' });
        }

        res.status(200).json(story.viewers || []);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── LIKE/UNLIKE STORY (PROTECTED) ───────────────────────────────────────────
router.post('/like/:storyId', verifyToken, [
    param('storyId').isMongoId().withMessage('Invalid story ID'),
    validate
], async (req, res) => {
    try {
        const userId = req.userId;
        const story = await Story.findById(req.params.storyId);
        if (!story) return res.status(404).json({ message: 'Story not found.' });

        const isLiked = (story.likes || []).some(id => id.toString() === userId.toString());

        // Privacy check
        const owner = await User.findById(story.user._id).select('isPrivate followers');
        if (owner.isPrivate && owner._id.toString() !== userId.toString() && !owner.followers.map(f => f.toString()).includes(userId.toString())) {
            return res.status(403).json({ message: 'This story is private.' });
        }

        if (isLiked) {
            // Atomic pull to ensure removal
            const updatedStory = await Story.findByIdAndUpdate(
                req.params.storyId,
                { $pull: { likes: userId } },
                { new: true }
            );

            if (_io) {
                _io.emit('storyUpdate', {
                    storyId: updatedStory._id,
                    likesCount: updatedStory.likes.length,
                    likes: updatedStory.likes
                });
            }
            const resObj = updatedStory.toObject();
            resObj.likesCount = updatedStory.likes.length;
            resObj.isLiked = false;
            return res.status(200).json(resObj);
        } else {
            // Atomic addToSet to prevent duplicates
            const updatedStory = await Story.findByIdAndUpdate(
                req.params.storyId,
                { $addToSet: { likes: userId } },
                { new: true }
            );

            if (_io) {
                _io.emit('storyUpdate', {
                    storyId: updatedStory._id,
                    likesCount: updatedStory.likes.length,
                    likes: updatedStory.likes
                });
            }

            // Create notification for story owner
            const sender = await User.findById(userId).select('fullname profile_picture').lean();
            if (sender) {
                await notificationUtils.createNotification({
                    recipientId: updatedStory.user._id,
                    sender: { id: userId, fullname: sender.fullname, profile_picture: sender.profile_picture },
                    type: 'like',
                    thumbnail: updatedStory.media?.url,
                    url: `/stories?user=${updatedStory.user._id}`,
                });
            }

            const resObj = updatedStory.toObject();
            resObj.likesCount = updatedStory.likes.length;
            resObj.isLiked = true;
            return res.status(200).json(resObj);
        }
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── DELETE STORY (PROTECTED) ─────────────────────────────────────────────────
router.delete('/:storyId', verifyToken, [
    param('storyId').isMongoId().withMessage('Invalid story ID'),
    validate
], async (req, res) => {
    try {
        const userId = req.userId;
        const story = await Story.findById(req.params.storyId);
        if (!story) return res.status(404).json({ message: 'Story not found.' });
        if (story.user._id.toString() !== userId.toString()) return res.status(403).json({ message: 'Unauthorized.' });
        await Story.findByIdAndDelete(req.params.storyId);
        if (_io) {
            _io.emit('storyDeleted', { storyId: req.params.storyId, userId: story.user._id });
        }
        res.status(200).json({ message: 'Story deleted.' });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── REPLY TO STORY (PROTECTED) ───────────────────────────────────────────────
router.post('/reply/:storyId', verifyToken, [
    param('storyId').isMongoId().withMessage('Invalid story ID'),
    body('text').optional().trim().escape(),
    body('content').optional().trim().escape(),
    validate
], async (req, res) => {
    try {
        const { storyId } = req.params;
        const userId = req.userId;
        const textContent = req.body.text || req.body.content || '';

        const story = await Story.findById(storyId);
        if (!story) return res.status(404).json({ message: 'Story not found.' });

        // 🔒 Privacy Guard: If story owner is private, replier must be a follower
        const storyOwner = await User.findById(story.user._id).select('isPrivate followers').lean();
        if (storyOwner && storyOwner.isPrivate) {
            const isFollower = (storyOwner.followers || []).some(id => id.toString() === userId.toString());
            const isOwner = storyOwner._id.toString() === userId.toString();
            if (!isOwner && !isFollower) {
                return res.status(403).json({ message: 'This story is private. Follow to reply.' });
            }
        }

        const sender = await User.findById(userId).select('fullname profile_picture').lean();
        if (!sender) return res.status(404).json({ message: 'User not found.' });

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
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── VOTE IN POLL (PROTECTED) ───────────────────────────────────────────────
router.post('/vote/:storyId', verifyToken, [
    param('storyId').isMongoId().withMessage('Invalid story ID'),
    body('optionIndex').isInt({ min: 0 }).withMessage('Invalid option index'),
    validate
], async (req, res) => {
    try {
        const userId = req.userId;
        const { optionIndex } = req.body;

        const story = await Story.findById(req.params.storyId);
        if (!story) return res.status(404).json({ message: 'Story not found.' });
        if (!story.poll || !story.poll.options || !story.poll.options[optionIndex]) {
            return res.status(400).json({ message: 'Invalid poll option.' });
        }

        // Clean user's previous votes from this poll (single choice only)
        story.poll.options.forEach(opt => {
            opt.votes = opt.votes.filter(id => id.toString() !== userId.toString());
        });

        // Register new vote
        story.poll.options[optionIndex].votes.push(userId);

        await story.save();

        if (_io) {
            _io.emit('storyUpdate', {
                storyId: story._id,
                poll: story.poll
            });
        }

        res.status(200).json(story);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
module.exports.setIo = setIo;
