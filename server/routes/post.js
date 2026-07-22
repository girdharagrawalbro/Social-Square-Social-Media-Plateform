const express = require('express');
const mongoose = require('mongoose');

const Post = require('../models/Post');
const { PostVector } = require('../models/Recommendation');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Category = require("../models/Category");
const Group = require("../models/Group");
const Collection = require('../models/Collection');
const { publish } = require('../lib/pubsub');
const {
    sanitizeAnonymousPost,
    getRestrictedUserIds,
    canViewPost,
    checkPostPrivacy,
    getOwnerToken,
    verifyOwnerToken
} = require('../utils/privacy');
const { analyzeComment } = require('../services/discussionAiService');
const eventBus = require('../lib/eventBus');
const redis = require('../lib/redis');
const verifyToken = require('../middleware/Verifytoken');
const softVerifyToken = require('../middleware/softVerifyToken');
const contentFilter = require('../middleware/contentFilter');
const { publishEvent } = require("../services/recommendationPublisher");
const notificationUtils = require('../lib/notification.js');
const { updateGamification } = require('../lib/gamification');
const jwt = require('jsonwebtoken');
const { hashValue } = require('../utils/authSecurity');
const LoginSession = require('../models/LoginSession');
const RedisBloomFilter = require('../lib/bloomFilter');
const postWriteLimiter = require('../middleware/postWriteLimiter'); // Break circular dependency
const { moderationQueue } = require('../queues/moderationQueue');
const { body, param, query, validationResult } = require('express-validator');
const { USER_DEFAULT_IMAGE } = require('../utils/constantMediaVariable.js');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
};

const router = express.Router();
const ANONYMOUS_USER_ID = "600000000000000000000000"; // Constant dummy ID for anonymous posts


// io is injected from index.js
let _io;
function setIo(io) { _io = io; }

// ─── CURSOR HELPERS ──────────────────────────────────────────────────────────
const encodeCursor = (date, id) => {
    if (!date || !id) return null;
    const timestamp = new Date(date).getTime();
    return Buffer.from(`${timestamp}_${id}`).toString('base64');
};

const decodeCursor = (cursorStr) => {
    try {
        if (!cursorStr) return null;
        const decoded = Buffer.from(cursorStr, 'base64').toString('ascii');
        const [timestamp, id] = decoded.split('_');
        if (!timestamp || !id) return null;
        return { date: new Date(parseInt(timestamp)), id };
    } catch (e) {
        return null;
    }
};

// ─── VIEW (PUBLIC) ────────────────────────────────────────────────────────────
router.post("/view/:postId", [
    param('postId').isMongoId().withMessage('Invalid post ID'),
    validate
], softVerifyToken, async (req, res) => {
    try {
        const { postId } = req.params;

        // Idempotency guard: avoid counting repeated rapid views from same client
        // Key: view:{postId}:{userOrIp} with short TTL
        const TTL_SECONDS = Number(process.env.VIEW_IDEMPOTENCY_SECONDS || 60);

        // viewerId resolved by softVerifyToken
        const viewerId = req.userId;

        // FIX #7: Explicitly call toString() on viewerId (ObjectId) for safe string use
        const viewerIdStr = viewerId ? viewerId.toString() : null;
        const clientId = viewerIdStr || (req.ip || req.connection && req.connection.remoteAddress || 'anonymous');
        const redisKey = `view:${postId}:${clientId}`;
        let setResult = 'OK';

        // SET NX with EX — returns 'OK' if set, null if key exists
        if (redis.status !== 'disabled') {
            setResult = await redis.set(redisKey, '1', 'EX', TTL_SECONDS, 'NX');
        }

        if (setResult === 'OK') {
            await Post.findByIdAndUpdate(postId, { $inc: { views: 1 } });

            // Add post to user's "Seen Posts" Bloom Filter if authenticated
            if (viewerIdStr) {
                const seenFilter = new RedisBloomFilter(`bf:seen:${viewerIdStr}`);
                await seenFilter.add(postId);
            }

            return res.status(200).json({ success: true, counted: true });
        } else {
            // Recently counted — skip increment
            return res.status(200).json({ success: true, counted: false });
        }
    } catch (e) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── VOTE (PROTECTED) ────────────────────────────────────────────────────────
router.post("/vote", verifyToken, [
    body('postId').isMongoId().withMessage('Invalid post ID'),
    body('optionIndex').isInt({ min: 0 }).withMessage('Invalid option index'),
    validate
], async (req, res) => {
    try {
        const { postId, optionIndex } = req.body;
        const userId = req.userId;

        const post = await Post.findById(postId);
        if (!post || !post.poll) return res.status(404).json({ message: "Poll not found." });

        if (post.poll.expiresAt && new Date() > new Date(post.poll.expiresAt)) {
            return res.status(400).json({ message: "This poll has expired." });
        }

        const hasVoted = post.poll.options.some(opt => opt.votes.includes(userId));
        if (hasVoted) return res.status(400).json({ message: "You have already voted." });

        if (!post.poll.options[optionIndex]) return res.status(400).json({ message: "Invalid option." });

        post.poll.options[optionIndex].votes.push(userId);
        await post.save();

        const rewards = await updateGamification(userId, 'reaction');
        if (_io) _io.emit('pollUpdate', { postId, poll: post.poll });

        res.status(200).json({ poll: post.poll, rewards });
    } catch (e) { res.status(500).json({ error: "Internal Server Error" }); }
});

function computeScore(post, followingIds = []) {
    const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
    return (post.views || 0)
        + (post.likes?.length || 0) * 2
        + (post.comments?.length || 0) * 4
        + (followingIds.includes(post.user._id.toString()) ? 20 : 0)
        + Math.max(0, 50 - ageHours * 0.5);
}

// ─── CREATE (PROTECTED + FILTERED) ───────────────────────────────────────────
router.post("/create", verifyToken, [
    body('category').notEmpty().trim().escape().withMessage('Category is required'),
    body('caption').optional().trim().escape().isLength({ max: 5000 }),
    body('imageURLs').optional().isArray().withMessage('imageURLs must be an array'),
    body('imageURLs.*').optional().isURL().withMessage('Invalid image URL'),
    body('videoURL').optional({ checkFalsy: true }).isURL().withMessage('Invalid video URL'),
    body('collaboratorIds').optional().isArray(),
    body('collaboratorIds.*').optional().isMongoId(),
    body('mentionIds').optional().isArray(),
    body('mentionIds.*').optional().isMongoId(),
    body('groupId').optional({ checkFalsy: true }).isMongoId(),
    body('isAnonymous').optional().isBoolean(),
    body('isCollaborative').optional().isBoolean(),
    validate
], contentFilter, async (req, res) => {
    try {
        const {
            caption, category, imageURLs, videoURL, location, music,
            isAnonymous, expiresAt, unlocksAt, isCollaborative,
            collaboratorIds, voiceNoteUrl, voiceNoteDuration, mood,
            isAiGenerated, groupId, poll, videoThumbnail, mentionIds, visibility,
            isBeforeAfter, beforeAfter, isFeedbackRequest, feedbackCategory, goalId,
            mediaKeys, videoKey, videoIv, voiceNoteKey, voiceNoteIv,
            beforeImageKey, beforeImageIv, afterImageKey, afterImageIv
        } = req.body;
        const loggedUserId = req.userId; // Secure: from token

        // DEBUG: Log video URL received
        if (videoURL) {
            console.log(' Backend received videoURL:', videoURL.substring(0, 50) + '...');
        }

        if (!loggedUserId || !category) return res.status(400).json({ message: "loggedUserId and category are required." });

        // 🛡️ Risk 3: Rate Limit Check (Moved to top to prevent DB bloat)
        if (isAnonymous) {
            const rateLimitKey = `rl:confession:${loggedUserId}`;
            const confessionCount = await redis.get(rateLimitKey);
            if (confessionCount && parseInt(confessionCount) >= 5) {
                return res.status(429).json({ message: "Confession limit reached (5 per hour). Please try again later." });
            }

            // Increment or set with 1 hour TTL
            if (!confessionCount) {
                await redis.set(rateLimitKey, '1', 'EX', 3600);
            } else {
                await redis.incr(rateLimitKey);
            }
        }

        const userDetails = await User.findById(loggedUserId).select('username fullname profile_picture followers postsCount');
        if (!userDetails) return res.status(404).json({ message: "User not found." });

        const isFirstPost = !isAnonymous && (!userDetails.postsCount || userDetails.postsCount === 0);

        let collaborators = [];
        if (isCollaborative && Array.isArray(collaboratorIds) && collaboratorIds.length > 0) {
            const collabUsers = await User.find({ _id: { $in: collaboratorIds } }).select('fullname profile_picture');
            collaborators = collabUsers.map(u => ({ userId: u._id, fullname: u.fullname, profile_picture: u.profile_picture, status: 'pending' }));
        }

        let calculatedImageUrls = Array.isArray(imageURLs) ? imageURLs : [];
        if (isBeforeAfter && beforeAfter && beforeAfter.type === 'image') {
            calculatedImageUrls = [beforeAfter.beforeUrl, beforeAfter.afterUrl].filter(Boolean);
        }

        const newPost = new Post({
            caption, category,
            image_urls: calculatedImageUrls,
            video: videoURL || null,
            videoThumbnail: videoThumbnail || null,
            user: isAnonymous
                ? {
                    _id: ANONYMOUS_USER_ID,
                    fullname: 'Anonymous',
                    profile_picture: USER_DEFAULT_IMAGE
                }
                : { _id: userDetails._id, fullname: userDetails.fullname, profile_picture: userDetails.profile_picture },
            location: location || {}, music: music || {},
            isAnonymous: !!isAnonymous,
            ownerToken: isAnonymous ? getOwnerToken(loggedUserId) : null,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            unlocksAt: unlocksAt ? new Date(unlocksAt) : null,
            isCollaborative: !!isCollaborative,
            collaborators,
            mentions: mentionIds || [],
            voiceNote: voiceNoteUrl ? { url: voiceNoteUrl, duration: voiceNoteDuration || null } : {},
            mood: mood || null,
            isAiGenerated: !!isAiGenerated,
            groupId: groupId || null,
            poll: poll || null,
            visibility: visibility || 'public',
            isBeforeAfter: !!isBeforeAfter,
            beforeAfter: beforeAfter || null,
            isFeedbackRequest: !!isFeedbackRequest,
            feedbackCategory: feedbackCategory || null,
            goalId: goalId || null,
            // 🛡️ Store real authorId (select: false) to enforce private user follower checks
            authorId: loggedUserId,
            // DRM / Encryption keys
            mediaKeys: mediaKeys || [],
            videoKey: videoKey || null,
            videoIv: videoIv || null,
            voiceNoteKey: voiceNoteKey || null,
            voiceNoteIv: voiceNoteIv || null,
            beforeImageKey: beforeImageKey || null,
            beforeImageIv: beforeImageIv || null,
            afterImageKey: afterImageKey || null,
            afterImageIv: afterImageIv || null
        });
        await newPost.save();
        if (!isAnonymous && caption) {
            const { handleMentions } = require('../services/mentionService');
            handleMentions(caption, loggedUserId, newPost._id, null, `/post/${newPost._id}`).catch(err => {
                console.error('[Mentions Post Error]:', err.message);
            });
        }
        if (!isAnonymous) {
            await User.findByIdAndUpdate(loggedUserId, { $inc: { postsCount: 1 } });
        }

        // DEBUG: Log saved post video field
        console.log(' Post saved with video field:', newPost.video ? 'YES' : 'NO (null or undefined)');

        if (groupId) {
            await Group.findByIdAndUpdate(groupId, { $push: { posts: newPost._id } });
        }


        if (collaborators.length > 0) {
            collaborators.forEach(async (c) => {
                if (_io) {
                    _io.to(c.userId.toString()).emit('collaborationInvite', { postId: newPost._id, postCaption: caption, invitedBy: userDetails.fullname });
                }

                // Also create a persistent notification
                await notificationUtils.createNotification({
                    recipientId: c.userId,
                    sender: { id: userDetails._id, fullname: userDetails.fullname, profile_picture: userDetails.profile_picture },
                    type: 'collab_invite',
                    postId: newPost._id,
                    thumbnail: newPost.image_urls?.[0],
                    url: `/post/${newPost._id}`,
                    message: { content: 'invited you to collaborate on a post' }
                });
            });
        }

        // Dispatch direct mention notifications
        if (Array.isArray(mentionIds) && mentionIds.length > 0) {
            mentionIds.forEach(async (mId) => {
                if (mId.toString() === loggedUserId.toString()) return;

                // Real-time socket emit
                if (_io) {
                    _io.to(mId.toString()).emit('newMention', { postId: newPost._id, senderName: userDetails.fullname });
                }

                // Persistent notification
                await notificationUtils.createNotification({
                    recipientId: mId,
                    sender: { id: userDetails._id, fullname: userDetails.fullname, profile_picture: userDetails.profile_picture },
                    type: 'mention',
                    postId: newPost._id,
                    thumbnail: newPost.image_urls?.[0],
                    url: `/post/${newPost._id}`,
                    message: { content: 'tagged you in a post' }
                });
            });
        }

        // Logic for followers' feed and notifications moved to postSubscriber (via NATS posts.created event)

        if (isAnonymous) {
            if (_io) {
                // Room-based emit: only users viewing confessions tab receive this
                _io.to('confessions').emit('newConfessionPost', newPost);
            }
        }

        if (!isAnonymous) {
            publish('posts.created', { id: newPost._id, user: newPost.user, category: newPost.category })
                .catch(err => console.warn('[NATS]:', err.message));
        }

        //  Add to Moderation Queue (Asynchronous)
        if (moderationQueue) {
            moderationQueue.add('moderate', {
                contentId: newPost._id,
                contentType: 'post',
                text: caption || ''
            }).catch(err => console.error('[ModerationQueue] Add error:', err.message));
        }

        //  Publish recommendation event
        await publishEvent("post.created", {
            postId: newPost._id.toString(),
            userId: userDetails._id.toString(),
            caption: newPost.caption || "",
            category: newPost.category || "",
            tags: newPost.tags || [],
            mood: newPost.mood || "",
            likesCount: 0,
            savesCount: 0,
            viewsCount: 0,
            sharesCount: 0,
            createdAtTs: Math.floor(new Date(newPost.createdAt).getTime() / 1000),
        });

        //  Update Gamification
        const rewards = await updateGamification(loggedUserId, 'post');
        if (rewards && _io) {
            _io.to(loggedUserId.toString()).emit('levelUpdate', rewards);
        }

        //  Invalidate Redis fallback cache
        if (redis.status !== 'disabled') {
            redis.del('cache:fallback_posts').catch(() => { });
        }

        res.status(201).json({ ...newPost.toObject(), rewards, isFirstPost });
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── ACCEPT COLLABORATION (PROTECTED) ──────────────────────────────────────────
router.post("/collaborate/accept", verifyToken, [
    body('postId').isMongoId().withMessage('Invalid post ID'),
    body('contribution').optional().trim().escape().isLength({ max: 1000 }),
    validate
], async (req, res) => {
    try {
        const { postId, contribution } = req.body;
        const userId = req.userId;
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found." });
        const idx = post.collaborators.findIndex(c => {
            const cId = c.userId || c._id;
            return cId && cId.toString() === userId.toString();
        });
        if (idx === -1) return res.status(403).json({ message: "Not a collaborator." });
        post.collaborators[idx].status = 'accepted';
        if (contribution) post.collaborators[idx].contribution = contribution;
        await post.save();
        if (_io) _io.to(post.user._id.toString()).emit('collaborationAccepted', { postId, userId: userId.toString() });
        res.status(200).json(post);
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── DECLINE COLLABORATION (PROTECTED) ───────────────────────────────────────────
router.post("/collaborate/decline", verifyToken, [
    body('postId').isMongoId().withMessage('Invalid post ID'),
    validate
], async (req, res) => {
    try {
        const { postId } = req.body;
        const userId = req.userId;
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found." });
        const idx = post.collaborators.findIndex(c => {
            const cId = c.userId || c._id;
            return cId && cId.toString() === userId.toString();
        });
        if (idx !== -1) {
            post.collaborators[idx].status = 'declined';
            await post.save();
        } else {
            return res.status(403).json({ message: "Not a collaborator." });
        }
        res.status(200).json({ message: "Declined." });
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── COLLABORATION INVITES ────────────────────────────────────────────────────
router.get("/collaborate/invites/:userId", verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;
        if (String(userId) !== String(req.userId)) return res.status(403).json({ error: 'Unauthorized' });

        const posts = await Post.find({
            collaborators: {
                $elemMatch: {
                    userId: userId,
                    status: 'pending'
                }
            }
        }).lean();
        res.status(200).json(posts);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── MY COLLABORATIONS ────────────────────────────────────────────────────────
router.get("/collaborate/mine/:userId", verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;
        if (String(userId) !== String(req.userId)) return res.status(403).json({ error: 'Unauthorized' });

        // Only return posts where this user is an accepted collaborator on SOMEONE ELSE's post
        const posts = await Post.find({
            'user._id': { $ne: userId }, // exclude their own posts
            collaborators: {
                $elemMatch: {
                    userId: userId,
                    status: 'accepted'
                }
            }
        }).sort({ createdAt: -1 }).lean();
        res.status(200).json(posts);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── UPDATE (PROTECTED) ──────────────────────────────────────────────────────────
router.put("/update/:postId", verifyToken, [
    param('postId').isMongoId().withMessage('Invalid post ID'),
    body('caption').optional().trim().escape().isLength({ max: 5000 }),
    body('category').optional().trim().escape(),
    validate
], postWriteLimiter, async (req, res) => {
    try {
        const { caption, category } = req.body;
        const userId = req.userId;

        // 1. Lightweight fetch to check anonymity state
        const initialPost = await Post.findOne({ _id: req.params.postId, deletedAt: null }).select('isAnonymous');
        if (!initialPost) return res.status(404).json({ message: "Post not found or already deleted." });

        // 2. Optimized fetch: only pull ownerToken if actually anonymous
        const selectFields = initialPost.isAnonymous ? '+ownerToken +authorId' : '+authorId';
        const post = await Post.findById(req.params.postId).select(selectFields);

        const postUserId = post.user?._id || post.user;
        let isOwner = false;

        if (post.isAnonymous) {
            //  Fix #1: Constant-time comparison (verifyOwnerToken uses timingSafeEqual)
            isOwner = verifyOwnerToken(userId, post.ownerToken) ||
                (post.authorId && post.authorId.toString() === userId.toString());
        } else {
            //  Fix #3: Safe string comparison for ObjectId vs String mismatch
            isOwner = (post.authorId && post.authorId.toString() === userId.toString()) ||
                (postUserId && postUserId.toString() === userId.toString());
        }

        if (!isOwner) return res.status(403).json({ message: "Unauthorized." });

        if (caption) post.caption = caption;
        if (category) post.category = category;
        await post.save();

        //  Notify all users about post update
        if (_io) _io.emit('postUpdated', { postId: post._id, caption: post.caption, category: post.category });

        res.status(200).json(post);
    } catch (error) {
        console.error('Update post error:', error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// ─── DELETE (PROTECTED) ──────────────────────────────────────────────────────────
router.delete("/delete/:postId", verifyToken, [
    param('postId').isMongoId().withMessage('Invalid post ID'),
    validate
], postWriteLimiter, async (req, res) => {
    try {
        const userId = req.userId;

        // 1. Lightweight fetch
        const initialPost = await Post.findById(req.params.postId).select('isAnonymous');
        if (!initialPost) return res.status(404).json({ message: "Post not found." });

        // 2. Optimized fetch
        const selectFields = initialPost.isAnonymous ? '+ownerToken +authorId' : '+authorId';
        const post = await Post.findById(req.params.postId).select(selectFields);

        const user = await User.findById(userId).select('isAdmin').lean();
        const isAdmin = user && user.isAdmin;

        const postUserId = post.user?._id || post.user;
        let isOwner = false;

        if (post.isAnonymous) {
            //  Fix #1: Constant-time comparison
            isOwner = verifyOwnerToken(userId, post.ownerToken) ||
                (post.authorId && post.authorId.toString() === userId.toString());
        } else {
            //  Fix #3: Type-safe check
            isOwner = (post.authorId && post.authorId.toString() === userId.toString()) ||
                (postUserId && postUserId.toString() === userId.toString());
        }

        if (!isOwner && !isAdmin) return res.status(403).json({ message: "Unauthorized." });

        // Atomic update to ensure idempotency and prevent race conditions in postsCount decrement
        // Only update if deletedAt is currently null
        const result = await Post.findOneAndUpdate(
            { _id: req.params.postId, deletedAt: null },
            { $set: { deletedAt: new Date() } },
            { new: true }
        );

        if (!result) {
            // If result is null, it means someone else (or another request) already set deletedAt
            return res.status(404).json({ message: "Post already deleted." });
        }

        //  Remove Recommendation Vector for the deleted post to save database space and prevent stale recommendations
        await PostVector.deleteOne({ postId: req.params.postId }).catch(err => {
            console.error('[Post Delete] Failed to delete PostVector:', err.message);
        });

        // Only decrement postsCount if this specific request was the one that performed the soft-delete
        // For anonymous posts, we use userId since authorId is null (Risk 1)
        const decrementUserId = (post.isAnonymous && isOwner) ? userId : post.authorId;
        if (decrementUserId && !post.isAnonymous) {
            await User.findByIdAndUpdate(decrementUserId, { $inc: { postsCount: -1 } });
        }

        //  Invalidate Redis fallback cache
        if (redis.status !== 'disabled') {
            redis.del('cache:fallback_posts').catch(() => { });
        }

        //  Notify all users to remove post from feed
        if (_io) _io.emit('postDeleted', { postId: req.params.postId });

        res.status(200).json({ message: "Post deleted.", postId: req.params.postId });
    } catch (error) {
        console.error('Delete post error:', error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Helper to limit consecutive posts from the same user (maxConsecutive defaults to 2)
function limitConsecutiveUserPosts(posts, maxConsecutive = 2) {
    const result = [];
    const remaining = [...posts];
    let lastUserId = null;
    let consecutiveCount = 0;

    const getPostUserId = (post) => {
        if (post.isAnonymous) {
            return `anon_${post._id ? post._id.toString() : Math.random()}`;
        }
        const uid = post.user?._id || post.user;
        return uid ? uid.toString() : '';
    };

    while (remaining.length > 0) {
        let foundIdx = -1;
        for (let i = 0; i < remaining.length; i++) {
            const p = remaining[i];
            const uid = getPostUserId(p);
            if (uid !== lastUserId || consecutiveCount < maxConsecutive) {
                foundIdx = i;
                break;
            }
        }

        if (foundIdx !== -1) {
            const post = remaining.splice(foundIdx, 1)[0];
            const uid = getPostUserId(post);
            if (uid === lastUserId) {
                consecutiveCount++;
            } else {
                lastUserId = uid;
                consecutiveCount = 1;
            }
            result.push(post);
        } else {
            // Exclude the rest if they would exceed consecutive limit and can't be interleaved
            break;
        }
    }
    return result;
}

// ─── FEED ─────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const cursor = req.query.cursor;
        const userId = req.query.userId;
        let followingIds = [], userCategories = [], excludedUserIds = [];
        if (userId) {
            // Validate userId is a valid 24-character hex string
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ error: "Invalid userId format" });
            }

            const user = await User.findById(userId).select('following blockedUsers mutedUsers').lean();
            if (user) {
                followingIds = (user.following || []).map(id => id.toString());
                excludedUserIds = [
                    ...(user.blockedUsers || []),
                    ...(user.mutedUsers || [])
                ].map(id => id.toString());

                // Also find users who have blocked the current user
                const blockers = await User.find({ blockedUsers: userId }).select('_id');
                const blockerIds = blockers.map(b => b._id.toString());
                // Exclude blockers + muted/blocked from feed results (but NOT self)
                excludedUserIds = [...new Set([...excludedUserIds, ...blockerIds])];
            }

            // Find users who have this user in their closeFriends list
            const cfUsers = await User.find({ closeFriends: userId }).select('_id');
            const closeFriendOfIds = cfUsers.map(u => u._id.toString());
            req.closeFriendOfIds = closeFriendOfIds; // stash for later use

            try {
                const likedPosts = await Post.find({ likes: userId }).select('category').limit(20);
                userCategories = [...new Set(likedPosts.map(p => p.category))];
            } catch (catErr) {
                console.error("[Feed] Failed to fetch liked categories:", catErr.message);
            }
        }

        // Exclude anonymous posts from normal feed — they appear in confessions feed only
        // Also exclude time-locked posts that haven't unlocked yet
        // ALSO: Exclude blocked/muted users
        const query = {
            isAnonymous: { $ne: true },
            deletedAt: null,
            isVisible: { $ne: false },
            'user._id': { $nin: excludedUserIds.filter(id => id && id.length === 24).map(id => new mongoose.Types.ObjectId(id)) },
            $or: [{ unlocksAt: null }, { unlocksAt: { $lte: new Date() } }],
        };

        if (req.query.depth && ['quick_take', 'deep_dive', 'long_read'].includes(req.query.depth)) {
            query.depthScore = req.query.depth;
        }

        if (userId) {
            query.$and = [
                {
                    $or: [
                        { visibility: 'public' },
                        { visibility: { $exists: false } },
                        { visibility: 'followers', 'user._id': { $in: followingIds.map(id => new mongoose.Types.ObjectId(id)) } },
                        { visibility: 'close_friends', 'user._id': { $in: (req.closeFriendOfIds || []).map(id => new mongoose.Types.ObjectId(id)) } },
                        { 'user._id': new mongoose.Types.ObjectId(userId) }
                    ]
                }
            ];
        } else {
            query.$and = [{ $or: [{ visibility: 'public' }, { visibility: { $exists: false } }] }];
        }

        if (cursor) {
            const decoded = decodeCursor(cursor);
            if (decoded) {
                query.$or = [
                    { createdAt: { $lt: decoded.date } },
                    { createdAt: decoded.date, _id: { $lt: decoded.id } }
                ];
            }
        }

        // Fetch partition counts
        const anonymousTargetCount = Math.max(1, Math.floor(limit * 0.1)); // 10% of feed (e.g. 1 post for limit=10)
        const oldTargetCount = Math.max(1, Math.floor(limit * 0.2)); // 20% of feed (e.g. 2 posts for limit=10)
        const recentLimit = limit - oldTargetCount - anonymousTargetCount;
        const candidateMultiplier = 4; // Fetch 4x more candidates to allow robust diversification
        const fetchLimit = (recentLimit * candidateMultiplier) + 1;

        const recentPosts = await Post.find(query).sort({ createdAt: -1 }).limit(fetchLimit).populate('mentions', 'username fullname').populate('goalId', 'title progress').lean().maxTimeMS(5000);
        const hasMore = recentPosts.length > (recentLimit * candidateMultiplier);

        // Fetch old unseen pics (20% of feed)
        let oldUnseenSelection = [];
        if (userId) {
            try {
                const oneDayAgo = new Date();
                oneDayAgo.setDate(oneDayAgo.getDate() - 2); // Older than 2 days

                // FIX: Two $or keys in the same JS object silently overwrite each other.
                // Both conditions are combined using $and to ensure both constraints apply.
                const oldPicsQuery = {
                    isAnonymous: { $ne: true },
                    deletedAt: null,
                    isVisible: { $ne: false },
                    'user._id': { $nin: excludedUserIds.filter(id => id && id.length === 24).map(id => new mongoose.Types.ObjectId(id)) },
                    createdAt: { $lt: oneDayAgo },
                    $and: [
                        { $or: [{ unlocksAt: null }, { unlocksAt: { $lte: new Date() } }] },
                        { $or: [{ image_url: { $ne: null } }, { image_urls: { $exists: true, $ne: [] } }] }
                    ]
                };

                const oldPicsCandidates = await Post.find(oldPicsQuery)
                    .sort({ createdAt: -1 }) // Newer-old posts first
                    .limit(50)
                    .populate('mentions', 'username fullname')
                    .lean();

                if (oldPicsCandidates.length > 0) {
                    let unseenCandidates = oldPicsCandidates;
                    if (redis.status !== 'disabled') {
                        const seenFilter = new RedisBloomFilter(`bf:seen:${userId}`);
                        const seenChecks = await seenFilter.mightContainMultiple(oldPicsCandidates.map(p => p._id.toString()));
                        unseenCandidates = oldPicsCandidates.filter((_, i) => !seenChecks[i]);
                    }
                    oldUnseenSelection = unseenCandidates.slice(0, oldTargetCount);
                }
            } catch (err) {
                console.error("[Feed] Failed to load old unseen pics:", err.message);
            }
        }

        // Fetch anonymous public interest posts (10% of feed)
        let anonymousSelection = [];
        if (userId) {
            try {
                // Fetch restricted user IDs (private accounts that this user does not follow)
                const restrictedIds = await getRestrictedUserIds(userId);

                const anonymousQuery = {
                    isAnonymous: true,
                    deletedAt: null,
                    isVisible: { $ne: false },
                    $and: [
                        { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }
                    ]
                };

                if (restrictedIds.length > 0) {
                    anonymousQuery.$and.push({
                        $or: [
                            { authorId: { $exists: false } },
                            { authorId: null },
                            { authorId: { $nin: restrictedIds.map(id => new mongoose.Types.ObjectId(id)) } }
                        ]
                    });
                }

                // Try to filter by matching user interest categories
                if (userCategories.length > 0) {
                    anonymousQuery.category = { $in: userCategories };
                }

                let anonCandidates = await Post.find(anonymousQuery)
                    .sort({ score: -1, createdAt: -1 })
                    .limit(50)
                    .populate('mentions', 'username fullname')
                    .lean();

                // Fallback: If no posts matching categories, fetch general confessions
                if (anonCandidates.length === 0 && userCategories.length > 0) {
                    const fallbackQuery = { ...anonymousQuery };
                    delete fallbackQuery.category;
                    anonCandidates = await Post.find(fallbackQuery)
                        .sort({ score: -1, createdAt: -1 })
                        .limit(50)
                        .populate('mentions', 'username fullname')
                        .lean();
                }

                if (anonCandidates.length > 0) {
                    let unseenAnon = anonCandidates;
                    if (redis.status !== 'disabled') {
                        const seenFilter = new RedisBloomFilter(`bf:seen:${userId}`);
                        const seenChecks = await seenFilter.mightContainMultiple(anonCandidates.map(p => p._id.toString()));
                        unseenAnon = anonCandidates.filter((_, i) => !seenChecks[i]);
                    }
                    anonymousSelection = unseenAnon.slice(0, anonymousTargetCount);
                }
            } catch (err) {
                console.error("[Feed] Failed to load anonymous interest posts:", err.message);
            }
        }

        // Combine all fetched recent candidates, old unseen, and anonymous posts
        const neededRecent = limit - oldUnseenSelection.length - anonymousSelection.length;
        const postsToProcess = [
            ...recentPosts,
            ...oldUnseenSelection,
            ...anonymousSelection
        ];

        // 🔒 Privacy Guard: Find any private users among the fetched posts that we don't follow
        const fetchedUserIds = [...new Set(postsToProcess.map(p => p.user && p.user._id ? p.user._id.toString() : null).filter(Boolean))];
        const usersToCheck = fetchedUserIds.filter(id => id !== userId && !followingIds.includes(id));

        let privateUserIdsExcluded = [];
        if (usersToCheck.length > 0) {
            const privateUsers = await User.find({
                _id: { $in: usersToCheck },
                isPrivate: true
            }).select('_id').lean();
            privateUserIdsExcluded = privateUsers.map(u => u._id.toString());
        }

        // Filter out posts from those private users (with safe check)
        let filteredPosts = postsToProcess.filter(p => p.user && p.user._id && !privateUserIdsExcluded.includes(p.user._id.toString()));

        // Split into posts from followed users and others (suggestions)
        const followingPosts = [];
        const suggestionPosts = [];

        for (const post of filteredPosts) {
            const authorIdStr = (post.user && post.user._id) ? post.user._id.toString() : "";
            if (followingIds.includes(authorIdStr)) followingPosts.push(post);
            else suggestionPosts.push(post);
        }

        const scoreAndBoost = (post) => {
            let score = computeScore(post, followingIds);
            if (userCategories.includes(post.category)) score += 15;
            return score;
        };

        // Sort both groups by score (following prioritized)
        followingPosts.sort((a, b) => scoreAndBoost(b) - scoreAndBoost(a));
        suggestionPosts.sort((a, b) => scoreAndBoost(b) - scoreAndBoost(a));

        // Compose final feed by interleaving following and suggestions, avoiding consecutive same-user posts.
        const result = [];
        let lastUserId = null;

        while (followingPosts.length > 0 || suggestionPosts.length > 0) {
            const preferFollowing = (result.length % 3) !== 2; // 2 following, 1 suggestion
            const findIdx = (arr, avoidId) => arr.findIndex(p => p.user && p.user._id && p.user._id.toString() !== avoidId);

            let prefArr = preferFollowing ? followingPosts : suggestionPosts;
            let altArr = preferFollowing ? suggestionPosts : followingPosts;

            let idx = findIdx(prefArr, lastUserId);
            if (idx !== -1) {
                result.push(prefArr.splice(idx, 1)[0]);
            } else {
                idx = findIdx(altArr, lastUserId);
                if (idx !== -1) {
                    result.push(altArr.splice(idx, 1)[0]);
                } else {
                    // No choice but to show the same user
                    if (prefArr.length > 0) result.push(prefArr.splice(0, 1)[0]);
                    else if (altArr.length > 0) result.push(altArr.splice(0, 1)[0]);
                }
            }
            if (result.length > 0) {
                const lastPost = result[result.length - 1];
                lastUserId = (lastPost.user && lastPost.user._id) ? lastPost.user._id.toString() : null;
            }
        }

        // Apply consecutive user limit (max 2 consecutive posts from the same user)
        const limitedResult = limitConsecutiveUserPosts(result, 2);
        const slicedResult = limitedResult.slice(0, limit);

        // The cursor should be based on the oldest post FETCHED in this batch from the recent pool, before scoring/sorting.
        // This ensures the next query picks up exactly where the DB query left off.
        const lastFetchedPost = recentPosts[recentPosts.length - 1];
        const nextCursor = (hasMore && lastFetchedPost) ? encodeCursor(lastFetchedPost.createdAt, lastFetchedPost._id) : null;

        // Fetch fresh presence for all users in the feed (excluding anonymous dummy)
        const uniqueUserIds = [...new Set(slicedResult.map(p => p.user && p.user._id ? p.user._id.toString() : null).filter(id => id && id !== "600000000000000000000000"))];
        const presenceMap = {};
        if (redis.status !== 'disabled' && uniqueUserIds.length > 0) {
            try {
                const presenceValues = await redis.hmget('online_users', uniqueUserIds);
                uniqueUserIds.forEach((uid, index) => {
                    presenceMap[uid] = !!presenceValues[index];
                });
            } catch (err) {
                console.error('[Presence Redis Error]', err);
            }
        }
        if (Object.keys(presenceMap).length === 0 && uniqueUserIds.length > 0) {
            try {
                const usersWithPresence = await User.find({ _id: { $in: uniqueUserIds } }).select('isOnline');
                usersWithPresence.forEach(u => presenceMap[u._id.toString()] = u.isOnline);
            } catch (err) {
                console.error('[Presence DB Fallback Error]', err);
            }
        }

        // Attach presence to results
        const resultWithPresence = slicedResult.map(p => {
            const po = p.toObject ? p.toObject() : p;
            if (po.user && po.user._id) {
                const uid = po.user._id.toString();
                po.user.isOnline = presenceMap[uid] || false;
                if (userId) {
                    po.user.isFollowing = followingIds.includes(uid);
                }
            }
            return po;
        });

        // NOTE: We no longer add feed posts to the Bloom Filter seen-set.
        // The Bloom Filter is reserved for the Explore/Recommendations engine.

        const finalPosts = resultWithPresence.map(p => sanitizeAnonymousPost(p, userId));
        res.status(200).json({ posts: finalPosts, nextCursor, hasMore });
    } catch (error) {
        console.error('[Feed] CRITICAL Error:', error.message);

        // 🛡️ Fail-Safe Fallback: Try a super-minimal query if the complex feed logic crashes/times out
        try {
            const simplePosts = await Post.find({ isAnonymous: { $ne: true }, isVisible: { $ne: false } })
                .sort({ _id: -1 })
                .limit(10)
                .lean()
                .maxTimeMS(3000); // Fail fast (3s)

            return res.status(200).json({
                posts: simplePosts,
                nextCursor: null,
                hasMore: false,
                isFallback: true,
                message: "Basic feed active (Database is slow)"
            });
        } catch (innerError) {
            console.error('[Feed] Fallback also failed:', innerError.message);
            res.status(503).json({ error: "Service temporarily overloaded. Please try again later." });
        }
    }
});

// ─── USER POSTS ───────────────────────────────────────────────────────────────
router.get("/user/:userId", [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    validate
], softVerifyToken, async (req, res) => {
    try {
        const viewerId = req.userId; // Resolved by softVerifyToken middleware
        const ownerId = req.params.userId;


        if (!mongoose.Types.ObjectId.isValid(ownerId)) {
            return res.status(400).json({ posts: [], nextCursor: null, hasMore: false });
        }


        // Priority owner check - resolves identity before privacy check
        const isOwner = viewerId && viewerId.toString() === ownerId;

        const postOwner = await User.findById(ownerId).select('isPrivate followers closeFriends').lean();
        if (!postOwner) return res.status(404).json({ message: "User not found" });

        const isFollower = viewerId && postOwner.followers?.some(f => f.toString() === viewerId.toString());
        const isCloseFriend = viewerId && postOwner.closeFriends?.some(f => f.toString() === viewerId.toString());

        if (postOwner.isPrivate && !isOwner && !isFollower) {
            return res.status(200).json({ posts: [], nextCursor: null, hasMore: false, isPrivate: true });
        }

        const limit = parseInt(req.query.limit) || 9;
        const cursor = req.query.cursor;
        const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
        // Show all posts where user is owner OR an accepted collaborator
        const query = {
            $or: [
                { 'user._id': ownerObjectId },
                {
                    collaborators: {
                        $elemMatch: {
                            userId: ownerObjectId,
                            status: 'accepted'
                        }
                    }
                }
            ],
            isVisible: { $ne: false },
            ...(!isOwner ? { isAnonymous: { $ne: true } } : {})
        };

        if (!isOwner) {
            query.$and = query.$and || [];
            const privacyCondition = {
                $or: [
                    { visibility: 'public' },
                    { visibility: { $exists: false } }
                ]
            };
            if (isFollower) privacyCondition.$or.push({ visibility: 'followers' });
            if (isCloseFriend) privacyCondition.$or.push({ visibility: 'close_friends' });
            query.$and.push(privacyCondition);
        }

        if (cursor) {
            const decoded = decodeCursor(cursor);
            if (decoded) {
                query.$and = [
                    {
                        $or: [
                            { createdAt: { $lt: decoded.date } },
                            { createdAt: decoded.date, _id: { $lt: decoded.id } }
                        ]
                    }
                ];
            }
        }

        const posts = await Post.find(query).sort({ createdAt: -1 }).limit(limit + 1).populate('mentions', 'username fullname').populate('goalId', 'title progress').lean();
        const hasMore = posts.length > limit;
        const result = hasMore ? posts.slice(0, limit) : posts;
        const sanitized = result.map(p => sanitizeAnonymousPost(p, viewerId));
        res.status(200).json({
            posts: sanitized,
            nextCursor: hasMore ? encodeCursor(result[result.length - 1].createdAt, result[result.length - 1]._id) : null,
            hasMore
        });
    } catch (error) {
        console.error('[Post Route] /user/:userId error:', error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── PUBLIC USER POSTS (Logged-out) ───────────────────────────────────────────
router.get("/public/user/:userId", [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    validate
], async (req, res) => {
    try {
        const ownerId = req.params.userId;
        const postOwner = await User.findById(ownerId).select('isPrivate').lean();

        if (!postOwner) return res.status(404).json({ message: "User not found." });

        // Set cache headers for aggressive CDN caching (5 minutes)
        res.setHeader('Cache-Control', 'public, max-age=300');

        if (postOwner.isPrivate) {
            return res.status(200).json({ posts: [], nextCursor: null, hasMore: false, isPrivate: true });
        }

        // Strict limit of 9 posts for logged-out users, no pagination
        const limit = 9;
        const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
        const query = {
            $or: [
                { 'user._id': ownerObjectId },
                {
                    collaborators: {
                        $elemMatch: {
                            userId: ownerObjectId,
                            status: 'accepted'
                        }
                    }
                }
            ],
            isVisible: { $ne: false },
            isAnonymous: { $ne: true } // Exclude anonymous posts
        };

        const posts = await Post.find(query)
            .sort({ _id: -1 })
            .limit(limit)
            .select('_id caption image_urls video videoThumbnail category likes comments createdAt user')
            .lean();

        // Strip sensitive user info and convert arrays to counts
        const sanitizedPosts = posts.map(post => {
            return {
                _id: post._id,
                caption: post.caption,
                image_urls: post.image_urls,
                video: post.video,
                videoThumbnail: post.videoThumbnail,
                category: post.category,
                createdAt: post.createdAt,
                likesCount: (post.likes || []).length,
                commentsCount: (post.comments || []).length,
                // We still provide empty arrays to prevent frontend crashes if it reads .length
                likes: [],
                comments: [],
                user: post.user ? {
                    _id: post.user._id,
                    fullname: post.user.fullname,
                    profile_picture: post.user.profile_picture
                } : null
            };
        });

        res.status(200).json({ posts: sanitizedPosts, nextCursor: null, hasMore: false });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── SAVE / UNSAVE (PROTECTED) ───────────────────────────────────────────────────
router.post("/save", verifyToken, [
    body('postId').isMongoId().withMessage('Invalid post ID'),
    validate
], async (req, res) => {
    try {
        const { postId } = req.body;
        const userId = req.userId;

        // Use atomic findOneAndUpdate to pull the post from savedPosts
        const updatedUser = await User.findOneAndUpdate(
            { _id: userId, savedPosts: postId },
            { $pull: { savedPosts: postId } },
            { new: true, select: '_id' }
        );

        if (updatedUser) {
            if (_io) _io.to(userId.toString()).emit('postSavedState', { postId, saved: false });
            return res.status(200).json({ saved: false });
        } else {
            // Not saved yet, add it
            const userExists = await User.findByIdAndUpdate(userId, { $addToSet: { savedPosts: postId } });
            if (!userExists) return res.status(404).json({ message: 'User not found.' });

            //  Publish recommendation event
            const post = await Post.findById(postId).select('category tags').lean();
            if (post) {
                await publishEvent("user.activity.save", {
                    userId,
                    postId: postId,
                    action: "save",
                    category: post.category || "",
                    tags: post.tags || [],
                    timestamp: Date.now() / 1000,
                });
            }

            if (_io) _io.to(userId.toString()).emit('postSavedState', { postId, saved: true });
            return res.status(200).json({ saved: true });
        }
    } catch (e) { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/saved-ids", verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('savedPosts').lean();
        if (!user) return res.status(404).json({ message: 'User not found.' });
        return res.status(200).json(user.savedPosts || []);
    } catch (e) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.get("/saved/:userId", verifyToken, [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    validate
], async (req, res) => {
    try {
        const { userId } = req.params;
        if (String(userId) !== String(req.userId)) return res.status(403).json({ error: 'Unauthorized' });

        const user = await User.findById(userId).select('savedPosts');
        if (!user) return res.status(404).json({ message: 'User not found.' });
        const posts = await Post.find({ _id: { $in: user.savedPosts } }).sort({ createdAt: -1 }).populate('mentions', 'username fullname').populate('goalId', 'title progress').lean();
        const sanitized = posts.map(p => sanitizeAnonymousPost(p, req.userId));
        res.status(200).json(sanitized);
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── SAVED POST COLLECTIONS (PROTECTED) ───────────────────────────────────────

// Get all collections for the logged-in user
router.get("/collections/all", verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const collections = await Collection.find({ user: userId })
            .select('name posts coverImage createdAt')
            .sort({ createdAt: -1 })
            .lean();

        const formatted = collections.map(c => ({
            _id: c._id,
            name: c.name,
            postCount: c.posts?.length || 0,
            coverImage: c.coverImage || null,
            posts: c.posts || []
        }));
        res.status(200).json(formatted);
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// Create a new collection
router.post("/collections/create", verifyToken, [
    body('name').notEmpty().trim().escape().withMessage('Collection name is required'),
    body('postId').optional().isMongoId(),
    validate
], async (req, res) => {
    try {
        const { name, postId } = req.body;
        const userId = req.userId;

        const exists = await Collection.findOne({ user: userId, name: new RegExp(`^${name}$`, 'i') });
        if (exists) return res.status(400).json({ message: 'Collection already exists with this name.' });

        let coverImage = null;
        let posts = [];

        if (postId) {
            const post = await Post.findById(postId).select('image_urls image_url videoThumbnail').lean();
            if (post) {
                posts.push(postId);
                coverImage = post.image_urls?.[0] || post.image_url || post.videoThumbnail || null;

                await User.findByIdAndUpdate(userId, { $addToSet: { savedPosts: postId } });
            }
        }

        const newCollection = new Collection({
            user: userId,
            name,
            posts,
            coverImage
        });

        await newCollection.save();
        res.status(201).json(newCollection);
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// Get post membership status across all collections
router.get("/collections/post-status/:postId", verifyToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.userId;

        const collections = await Collection.find({ user: userId }).lean();
        const status = collections.map(c => ({
            _id: c._id,
            name: c.name,
            hasPost: c.posts?.map(p => p.toString()).includes(postId.toString()) || false
        }));

        res.status(200).json(status);
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// Toggle a post in a collection (Add/Remove)
router.post("/collections/toggle-post", verifyToken, [
    body('collectionId').isMongoId().withMessage('Invalid collection ID'),
    body('postId').isMongoId().withMessage('Invalid post ID'),
    validate
], async (req, res) => {
    try {
        const { collectionId, postId } = req.body;
        const userId = req.userId;

        const collection = await Collection.findOne({ _id: collectionId, user: userId });
        if (!collection) return res.status(404).json({ message: 'Collection not found.' });

        const postIndex = collection.posts.indexOf(postId);
        let saved = false;

        if (postIndex > -1) {
            collection.posts.splice(postIndex, 1);
            if (collection.posts.length > 0) {
                const firstPost = await Post.findById(collection.posts[0]).select('image_urls image_url videoThumbnail').lean();
                collection.coverImage = firstPost ? (firstPost.image_urls?.[0] || firstPost.image_url || firstPost.videoThumbnail) : null;
            } else {
                collection.coverImage = null;
            }
        } else {
            collection.posts.push(postId);
            saved = true;
            if (!collection.coverImage) {
                const post = await Post.findById(postId).select('image_urls image_url videoThumbnail').lean();
                collection.coverImage = post ? (post.image_urls?.[0] || post.image_url || post.videoThumbnail) : null;
            }

            await User.findByIdAndUpdate(userId, { $addToSet: { savedPosts: postId } });
        }

        await collection.save();
        res.status(200).json({ success: true, saved, collection });
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// Delete a collection
router.delete("/collections/:id", verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const result = await Collection.findOneAndDelete({ _id: req.params.id, user: userId });
        if (!result) return res.status(404).json({ message: 'Collection not found.' });
        res.status(200).json({ success: true, message: 'Collection deleted successfully.' });
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// Get posts in a collection
router.get("/collections/:id", verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const collection = await Collection.findOne({ _id: req.params.id, user: userId }).lean();
        if (!collection) return res.status(404).json({ message: 'Collection not found.' });

        const posts = await Post.find({ _id: { $in: collection.posts } }).sort({ createdAt: -1 }).populate('mentions', 'username fullname').lean();
        const sanitized = posts.map(p => sanitizeAnonymousPost(p, userId));

        res.status(200).json({ collection, posts: sanitized });
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── REACT (PROTECTED) ────────────────────────────────────────────────────────
router.post("/react", verifyToken, [
    body('postId').isMongoId().withMessage('Invalid post ID'),
    body('emoji').notEmpty().trim().escape().withMessage('Emoji is required'),
    validate
], async (req, res) => {
    try {
        const { postId, emoji } = req.body;
        const userId = req.userId;
        if (!postId || !emoji) return res.status(400).json({ message: 'PostId and emoji required.' });

        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post not found.' });

        // Deduplicate reactions array by user ID to resolve race conditions
        post.reactions = (post.reactions || []).filter((r, index, self) =>
            r.userId && self.findIndex(o => o.userId?.toString() === r.userId?.toString()) === index
        );

        const existingIdx = post.reactions.findIndex(r => r.userId?.toString() === userId);

        if (existingIdx !== -1) {
            if (post.reactions[existingIdx].emoji === emoji) {
                // Toggle off if same emoji
                post.reactions.splice(existingIdx, 1);
                // Also remove from likes if it was there (Atomic pull)
                post.likes = post.likes.filter(id => id.toString() !== userId);
            } else {
                // Change emoji
                post.reactions[existingIdx].emoji = emoji;
                // Ensure it's in likes for backward compatibility/quick counts
                // FIX: use .some() instead of .includes() for ObjectId comparison
                if (!post.likes.some(id => id.toString() === userId)) {
                    post.likes.push(userId);
                }
            }
        } else {
            // New reaction
            post.reactions.push({ userId, emoji });
            // FIX: use .some() instead of .includes() for ObjectId comparison
            if (!post.likes.some(id => id.toString() === userId)) {
                post.likes.push(userId);
            }
        }

        post.score = computeScore(post);
        await post.save();

        if (_io) _io.emit('postReacted', { postId, reactions: post.reactions, likesCount: post.likes.length });

        // Notification logic (only for new reactions, not changes)
        if (existingIdx === -1 && post.user._id.toString() !== userId) {
            const sender = await User.findById(userId).select('fullname profile_picture').lean();
            if (sender) {
                await notificationUtils.createNotification({
                    recipientId: post.user._id,
                    sender: { id: userId, fullname: sender.fullname, profile_picture: sender.profile_picture },
                    type: 'reaction',
                    postId: post._id,
                    thumbnail: post.image_urls?.[0],
                    message: { emoji },
                    url: `/post/${post._id}`,
                });
            }
        }

        //  Update Gamification
        const rewards = await updateGamification(userId, 'reaction');
        if (rewards && _io) _io.to(userId.toString()).emit('levelUpdate', rewards);

        res.status(200).json({ ...post.toObject(), rewards });
    } catch (e) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── PULSE / TRENDING ────────────────────────────────────────────────────────
router.get("/trending", async (req, res) => {
    try {
        const cacheKey = 'cache:trending';
        if (redis.status !== 'disabled') {
            try {
                const cached = await redis.get(cacheKey);
                if (cached) return res.status(200).json(JSON.parse(cached));
            } catch (err) {
                console.error('[Trending Cache Error]', err);
            }
        }

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // 1. Trending Categories
        const categories = await Post.aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo }, isAnonymous: { $ne: true } } },
            { $group: { _id: '$category', postCount: { $sum: 1 }, totalLikes: { $sum: { $size: { $ifNull: ['$likes', []] } } } } },
            { $sort: { totalLikes: -1, postCount: -1 } },
            { $limit: 8 }
        ]);

        // 2. Trending Hashtags (Manual extraction from captions) - Limit 500 & Lean
        const postsWithHashtags = await Post.find({
            createdAt: { $gte: sevenDaysAgo },
            isAnonymous: { $ne: true },
            caption: { $regex: /#/ }
        }).select('caption').limit(500).lean();

        const hashtagMap = {};
        postsWithHashtags.forEach(p => {
            const tags = p.caption.match(/#[\w]+/g) || [];
            tags.forEach(t => { hashtagMap[t] = (hashtagMap[t] || 0) + 1; });
        });
        const hashtags = Object.entries(hashtagMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([tag, count]) => ({ tag, count }));

        // 3. Top Users (Rising Stars)
        const topUsersAgg = await Post.aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo }, isAnonymous: { $ne: true } } },
            { $group: { _id: '$user._id', totalLikes: { $sum: { $size: { $ifNull: ['$likes', []] } } }, postCount: { $sum: 1 } } },
            { $sort: { totalLikes: -1 } },
            { $limit: 5 }
        ]);

        const topUserIds = topUsersAgg.map(u => u._id);
        const topUsersInfo = await User.find({ _id: { $in: topUserIds } }).select('fullname username profile_picture followers isOnline').lean();

        const topUsers = topUsersAgg.map(u => {
            const info = topUsersInfo.find(ui => ui._id.toString() === u._id.toString());
            return {
                ...u,
                user: info
            };
        });

        const result = { categories, hashtags, topUsers };

        if (redis.status !== 'disabled') {
            try {
                await redis.set(cacheKey, JSON.stringify(result), 'EX', 600); // 10 minutes cache
            } catch (err) {
                console.error('[Trending Cache Set Error]', err);
            }
        }

        res.status(200).json(result);
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── LIKE (PROTECTED) ─────────────────────────────────────────────────────────
router.post("/like", verifyToken, [
    body('postId').isMongoId().withMessage('Invalid post ID'),
    validate
], async (req, res) => {
    try {
        const { postId } = req.body;
        const userId = req.userId;
        if (!postId) return res.status(400).json({ message: 'PostId required.' });

        // Atomic update first
        const updatedPost = await Post.findOneAndUpdate(
            { _id: postId, likes: { $ne: userId } },
            {
                $addToSet: { likes: userId },
                $push: { reactions: { userId, emoji: '❤️' } }
            },
            { new: true }
        );

        if (!updatedPost) {
            // Check if post exists or if it's already liked
            const post = await Post.findById(postId);
            if (!post) return res.status(404).json({ message: 'Post not found.' });
            // Return success even if already liked — for optimistic UI robustness
            return res.status(200).json({ success: true, message: 'Already liked.', post });
        }

        const newScore = computeScore(updatedPost);
        await Post.updateOne({ _id: postId }, { $set: { score: newScore } });
        updatedPost.score = newScore;

        //  Broadcast like update to all connected users
        if (_io) _io.emit('postLiked', { postId, userId, likesCount: updatedPost.likes.length });

        // Create notification for post owner
        const sender = await User.findById(userId).select('fullname profile_picture').lean();
        if (sender) {
            await notificationUtils.createNotification({
                recipientId: updatedPost.user._id,
                sender: { id: userId, fullname: sender.fullname, profile_picture: sender.profile_picture },
                type: 'like',
                postId: updatedPost._id,
                thumbnail: updatedPost.image_urls?.[0],
                url: `/post/${updatedPost._id}`,
            });
        }

        //  Publish recommendation event
        await publishEvent("user.activity.like", {
            userId,
            postId: updatedPost._id.toString(),
            action: "like",
            category: updatedPost.category || "",
            tags: updatedPost.tags || [],
            timestamp: Date.now() / 1000,
        });

        res.status(200).json({ success: true, post: updatedPost });
    } catch (e) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── SHARE POST (PROTECTED) ───────────────────────────────────────────────────
router.post("/share", verifyToken, [
    body('postId').isMongoId().withMessage('Invalid post ID'),
    validate
], async (req, res) => {
    try {
        const { postId } = req.body;
        const userId = req.userId;
        if (!postId) return res.status(400).json({ message: 'PostId required.' });

        const updatedPost = await Post.findByIdAndUpdate(
            postId,
            { $inc: { shares: 1 } },
            { new: true }
        );

        if (!updatedPost) {
            return res.status(404).json({ message: 'Post not found.' });
        }

        const newScore = computeScore(updatedPost);
        await Post.updateOne({ _id: postId }, { $set: { score: newScore } });
        updatedPost.score = newScore;

        // Broadcast share count update via Socket.io
        if (_io) _io.emit('postShared', { postId, sharesCount: updatedPost.shares });

        // Add to Gamification
        const rewards = await updateGamification(userId, 'share');
        if (rewards && _io) {
            _io.to(userId.toString()).emit('levelUpdate', rewards);
        }

        // Publish to Recommender Queue
        await publishEvent('post.share', {
            postId: postId.toString(),
            userId: userId.toString()
        }).catch(() => { });

        return res.status(200).json({ success: true, sharesCount: updatedPost.shares });
    } catch (error) {
        console.error('[Share Post] Error:', error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── UNLIKE (PROTECTED) ───────────────────────────────────────────────────────
router.post("/unlike", verifyToken, [
    body('postId').isMongoId().withMessage('Invalid post ID'),
    validate
], async (req, res) => {
    try {
        const { postId } = req.body;
        const userId = req.userId;
        if (!postId) return res.status(400).json({ message: 'PostId required.' });

        // Atomic update first
        const updatedPost = await Post.findOneAndUpdate(
            { _id: postId, likes: userId },
            {
                $pull: {
                    likes: userId,
                    reactions: { userId: userId }
                }
            },
            { new: true }
        );

        if (updatedPost) {
            const newScore = computeScore(updatedPost);
            await Post.updateOne({ _id: postId }, { $set: { score: newScore } });
            updatedPost.score = newScore;

            //  Broadcast unlike update to all connected users
            if (_io) _io.emit('postUnliked', { postId, userId, likesCount: updatedPost.likes.length });

            res.status(200).json({ success: true, post: updatedPost });
        } else {
            // Check if post exists or if it was already unliked
            const post = await Post.findById(postId);
            if (!post) return res.status(404).json({ message: 'Post not found.' });
            // Return success even if not liked — for optimistic UI robustness
            res.status(200).json({ success: true, message: "Already unliked.", post });
        }
    } catch (e) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
router.get("/categories", async (req, res) => {
    try {
        const categories = await Category.find();
        res.status(200).json(categories);
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get('/comments', softVerifyToken, [
    query('postId').isMongoId().withMessage('Invalid post ID'),
    validate
], async (req, res) => {
    try {
        const { postId } = req.query;
        if (!postId || typeof postId !== 'string') return res.status(400).json({ error: 'postId required as query param' });

        // 1. Fetch post and owner to check privacy
        const post = await Post.findById(postId).select('user').lean();
        if (!post) return res.status(404).json({ error: 'Post not found' });

        // Extract viewerId
        const viewerId = req.userId;

        const ownerId = post.user._id.toString();
        const postOwner = await User.findById(ownerId).select('isPrivate followers').lean();

        if (postOwner && postOwner.isPrivate) {
            const isOwner = viewerId && viewerId.toString() === ownerId;
            const isFollower = viewerId && postOwner.followers?.some(f => f.toString() === viewerId.toString());
            if (!isOwner && !isFollower) {
                return res.status(403).json({ error: 'This post is private. Follow to see comments.' });
            }
        }

        // 2. Fetch all parent comments
        const comments = await Comment.find({ postId, parentId: null, isVisible: { $ne: false } }).sort({ createdAt: 1 }).lean();
        if (!comments.length) return res.status(200).json([]);

        // 2. Fetch all replies for these parents in one single query (Optimized)
        const parentIds = comments.map(c => c._id);
        const allReplies = await Comment.find({ parentId: { $in: parentIds }, isVisible: { $ne: false } }).sort({ createdAt: 1 }).lean();

        // 3. Map replies to their parents
        const replyMap = {};
        allReplies.forEach(reply => {
            const pid = reply.parentId.toString();
            if (!replyMap[pid]) replyMap[pid] = [];
            replyMap[pid].push(reply);
        });

        const withReplies = comments.map(comment => ({
            ...comment,
            repliesList: replyMap[comment._id.toString()] || []
        }));

        res.status(200).json(withReplies);
    } catch (e) {
        console.error('[Post] Fetch comments error:', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/comments/add', verifyToken, [
    body('postId').isMongoId().withMessage('Invalid post ID'),
    body('content').optional().trim().escape().isLength({ max: 4000 }),
    body('parentId').optional().isMongoId(),
    body('feedbackDetails').optional().isObject(),
    validate
], contentFilter, async (req, res) => {
    try {
        const { content, postId, user, parentId, feedbackDetails } = req.body;
        if ((!content && !feedbackDetails) || !postId || !user) return res.status(400).json({ error: 'Invalid data' });

        const commentContent = content || `Rating: ${feedbackDetails.rating}/5\nStrengths: ${feedbackDetails.strengths}\nSuggestions: ${feedbackDetails.improvements}`;
        const newComment = new Comment({
            postId,
            content: commentContent,
            user,
            parentId: parentId || null,
            feedbackDetails: feedbackDetails || null
        });
        await newComment.save();

        if (parentId) {
            await Comment.findByIdAndUpdate(parentId, { $push: { replies: newComment._id } });
        } else {
            const post = await Post.findById(postId);
            post.comments.push(newComment._id);
            post.score = computeScore(post);
            await post.save();
        }

        //  Add to Moderation Queue (Asynchronous)
        if (moderationQueue) {
            moderationQueue.add('moderate', {
                contentId: newComment._id,
                contentType: 'comment',
                text: content || ''
            }).catch(err => console.error('[ModerationQueue] Add error:', err.message));
        }

        // FIX #4: Combine into one query instead of two separate Post.findById calls
        const postData = await Post.findById(postId).select('comments image_urls user').lean();
        const commentsCount = postData?.comments?.length || 0;

        //  Broadcast new comment to all users viewing this post
        if (_io) {
            _io.emit('newComment', {
                postId,
                comment: { ...newComment.toObject(), repliesList: [] },
                parentId: parentId || null,
                commentsCount,
            });
        }

        // FIX #4: Reuse postData for notification instead of another query
        let targetRecipientId;
        if (parentId) {
            const parentComment = await Comment.findById(parentId).select('user').lean();
            targetRecipientId = parentComment?.user?.id;
        } else {
            targetRecipientId = postData?.user?._id;
        }

        if (targetRecipientId) {
            await notificationUtils.createNotification({
                recipientId: targetRecipientId,
                sender: { id: user.id || user._id, fullname: user.fullname, profile_picture: user.profile_picture },
                type: 'comment',
                postId: postId,
                thumbnail: postData?.image_urls?.[0],
                message: { content: content.substring(0, 50) },
                url: `/post/${postId}`,
            });
        }

        // Dispatch mentions
        if (content) {
            const { handleMentions } = require('../services/mentionService');
            handleMentions(content, user.id || user._id, postId, newComment._id, `/post/${postId}`).catch(err => {
                console.error('[Mentions Comment Error]:', err.message);
            });
        }

        //  Update Gamification
        const rewards = await updateGamification(user.id || user._id, 'comment');
        if (rewards && _io) _io.to((user.id || user._id).toString()).emit('levelUpdate', rewards);

        //  Asynchronous AI Quality & Topic Analysis (Only for parent comments or substantial replies)
        if (!parentId || content.length > 20) {
            setImmediate(async () => {
                try {
                    const analysis = await analyzeComment(content, postData?.caption || '');
                    await Comment.findByIdAndUpdate(newComment._id, {
                        quality: analysis.quality,
                        topic: analysis.topic
                    });

                    if (_io) {
                        _io.emit('commentUpdated', {
                            commentId: newComment._id,
                            postId: postId,
                            updates: { quality: analysis.quality, topic: analysis.topic }
                        });
                    }

                    // Emit to local eventBus for recommenderWorker to generate vector
                    eventBus.emit("comment.created", {
                        commentId: newComment._id,
                        postId: postId,
                        content: content,
                        topic: analysis.topic
                    });
                } catch (err) {
                    console.error('[Async AI Analysis Error]', err);
                }
            });
        }

        return res.status(200).json({ ...newComment.toObject(), rewards, commentsCount });
    } catch (error) { return res.status(500).json({ error: 'Server error' }); }
});

// ─── MARK BEST ANSWER (PROTECTED) ─────────────────────────────────────────────
router.put('/comments/:commentId/mark-best', verifyToken, [
    param('commentId').isMongoId().withMessage('Invalid comment ID'),
    validate
], async (req, res) => {
    try {
        const userId = req.userId;
        const comment = await Comment.findById(req.params.commentId);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        const post = await Post.findById(comment.postId).select('user').lean();
        if (!post) return res.status(404).json({ error: 'Post not found' });

        // Only post author can mark best answer
        if (post.user._id.toString() !== userId.toString()) {
            return res.status(403).json({ error: 'Only post author can mark the best answer' });
        }

        const isCurrentlyBest = comment.isBestAnswer;

        // Reset all comments for this post
        await Comment.updateMany({ postId: comment.postId }, { isBestAnswer: false });

        // If it wasn't the best answer before, set it now. If it was, we just un-marked it.
        if (!isCurrentlyBest) {
            await Comment.findByIdAndUpdate(comment._id, { isBestAnswer: true });
        }

        if (_io) {
            _io.emit('commentMarkedBest', {
                postId: comment.postId,
                commentId: !isCurrentlyBest ? comment._id : null
            });
        }

        res.status(200).json({ isBestAnswer: !isCurrentlyBest });
    } catch (error) {
        console.error('[Mark Best Answer Error]', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── MARK INSIGHTFUL (PROTECTED) ──────────────────────────────────────────────
router.put('/comments/:commentId/mark-insightful', verifyToken, [
    param('commentId').isMongoId().withMessage('Invalid comment ID'),
    validate
], async (req, res) => {
    try {
        const userId = req.userId;
        const comment = await Comment.findById(req.params.commentId);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        const post = await Post.findById(comment.postId).select('user').lean();
        if (!post) return res.status(404).json({ error: 'Post not found' });

        // Only post author can mark insightful
        if (post.user._id.toString() !== userId.toString()) {
            return res.status(403).json({ error: 'Only post author can mark as insightful' });
        }

        const newValue = !comment.isInsightful;
        await Comment.findByIdAndUpdate(comment._id, { isInsightful: newValue });

        if (_io) {
            _io.emit('commentUpdated', {
                commentId: comment._id,
                postId: comment.postId,
                updates: { isInsightful: newValue }
            });
        }

        res.status(200).json({ isInsightful: newValue });
    } catch (error) {
        console.error('[Mark Insightful Error]', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── DELETE COMMENT (PROTECTED) ───────────────────────────────────────────────
router.delete('/comments/:commentId', verifyToken, [
    param('commentId').isMongoId().withMessage('Invalid comment ID'),
    validate
], async (req, res) => {
    try {
        const userId = req.userId;
        const comment = await Comment.findById(req.params.commentId);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        // FIX #5: Allow admins to delete any comment (consistent with post delete)
        const user = await User.findById(userId).select('isAdmin').lean();
        const isOwner = comment.user._id.toString() === userId.toString();
        const isAdmin = user && user.isAdmin;

        if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Unauthorized' });

        if (comment.parentId) {
            await Comment.findByIdAndUpdate(comment.parentId, { $pull: { replies: comment._id } });
        } else {
            await Post.findByIdAndUpdate(comment.postId, { $pull: { comments: comment._id } });
        }

        await Comment.deleteMany({ parentId: comment._id });
        await Comment.findByIdAndDelete(req.params.commentId);

        let commentsCount = 0;
        if (!comment.parentId) {
            const postData = await Post.findById(comment.postId).select('comments').lean();
            commentsCount = postData?.comments?.length || 0;
        }

        //  Broadcast comment deletion
        if (_io) {
            _io.emit('commentDeleted', {
                commentId: req.params.commentId,
                postId: comment.postId,
                parentId: comment.parentId || null,
                commentsCount,
            });
        }

        res.status(200).json({ message: 'Comment deleted', commentId: req.params.commentId, commentsCount });
    } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

// ─── LIKE COMMENT (PROTECTED) ─────────────────────────────────────────────────
router.post('/comments/:commentId/like', verifyToken, [
    param('commentId').isMongoId().withMessage('Invalid comment ID'),
    validate
], async (req, res) => {
    try {
        const userId = req.userId;
        const comment = await Comment.findById(req.params.commentId);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });
        const liked = (comment.likes || []).some(id => id.toString() === userId.toString());
        if (liked) {
            await Comment.findByIdAndUpdate(req.params.commentId, { $pull: { likes: userId } });
        } else {
            await Comment.findByIdAndUpdate(req.params.commentId, { $addToSet: { likes: userId } });
        }

        //  Broadcast comment like
        if (_io) {
            _io.emit('commentLiked', {
                commentId: req.params.commentId,
                postId: comment.postId,
                userId,
                liked: !liked,
            });
        }

        res.status(200).json({ liked: !liked });
    } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

// ─── SINGLE POST DETAIL ───────────────────────────────────────────────────────
router.get("/detail/:postId", [
    param('postId').isMongoId().withMessage('Invalid post ID'),
    validate
], softVerifyToken, checkPostPrivacy, async (req, res) => {
    try {
        const post = req.post;
        const viewerId = req.userId;
        // Wait, checkPostPrivacy currently relies on req.userId being set.
        // I need to ensure it handles optional auth.


        //  Publish recommendation event
        await publishEvent("user.activity.view", {
            userId: viewerId,
            postId: post._id.toString(),
            action: "view",
            category: post.category || "",
            tags: post.tags || [],
            timestamp: Date.now() / 1000,
        });

        const sanitized = sanitizeAnonymousPost(post.toObject(), viewerId);
        res.status(200).json(sanitized);
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── MUTE/BLOCK AUTHOR BY POST ID (PROTECTED) ──────────────────────────────────
router.post("/:postId/mute-author", verifyToken, [
    param('postId').isMongoId().withMessage('Invalid post ID'),
    validate
], async (req, res) => {
    try {
        const { postId } = req.params;
        const post = await Post.findById(postId).select('+authorId user');
        if (!post) return res.status(404).json({ error: 'Post not found' });

        const targetUserId = post.isAnonymous ? post.authorId : post.user?._id;
        if (!targetUserId) return res.status(400).json({ error: 'Author not found' });
        if (targetUserId.toString() === req.userId.toString()) {
            return res.status(400).json({ error: 'Cannot mute yourself' });
        }

        await User.findByIdAndUpdate(req.userId, { $addToSet: { mutedUsers: targetUserId } });
        res.status(200).json({ message: 'User muted' });
    } catch (e) {
        console.error('[Mute Author Error]', e);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post("/:postId/block-author", verifyToken, [
    param('postId').isMongoId().withMessage('Invalid post ID'),
    validate
], async (req, res) => {
    try {
        const { postId } = req.params;
        const post = await Post.findById(postId).select('+authorId user');
        if (!post) return res.status(404).json({ error: 'Post not found' });

        const targetUserId = post.isAnonymous ? post.authorId : post.user?._id;
        if (!targetUserId) return res.status(400).json({ error: 'Author not found' });
        if (targetUserId.toString() === req.userId.toString()) {
            return res.status(400).json({ error: 'Cannot block yourself' });
        }

        await Promise.all([
            User.findByIdAndUpdate(req.userId, {
                $addToSet: { blockedUsers: targetUserId },
                $pull: { following: targetUserId }
            }),
            User.findByIdAndUpdate(targetUserId, { $pull: { followers: req.userId } })
        ]);

        const redis = require('../lib/redis');
        await Promise.all([
            redis.del(`restricted_users:excl:${req.userId}`),
            redis.del(`restricted_users:excl:${targetUserId}`)
        ]).catch(err => console.error('[Block Author Redis Error]', err));

        res.status(200).json({ message: 'User blocked' });
    } catch (e) {
        console.error('[Block Author Error]', e);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── CONFESSIONS FEED ────────────────────────────────────────────────────────
// Anonymous posts only — identity is never revealed, sorted by score
router.get("/confessions", softVerifyToken, async (req, res) => {
    try {
        const viewerId = req.userId;
        const limit = parseInt(req.query.limit) || 9;
        const cursor = req.query.cursor;

        // Fetch restricted users (private accounts that the viewer is not following)
        let excludedUserIds = [];
        let blockedOrMutedIds = [];
        if (viewerId) {
            excludedUserIds = await getRestrictedUserIds(viewerId);
            const viewer = await User.findById(viewerId).select('blockedUsers mutedUsers').lean();
            if (viewer) {
                blockedOrMutedIds = [
                    ...(viewer.blockedUsers || []),
                    ...(viewer.mutedUsers || [])
                ].map(id => id.toString());
            }
        } else {
            // Guests cannot see anonymous posts from private users at all
            const privateUsers = await User.find({ isPrivate: true }).select('_id').lean();
            excludedUserIds = privateUsers.map(u => u._id.toString());
        }

        const query = {
            isAnonymous: true,
            deletedAt: null,
            $and: [
                { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }
            ],
            ...(cursor ? { _id: { $lt: cursor } } : {}),
        };

        if (excludedUserIds.length > 0) {
            query.$and.push({
                $or: [
                    { authorId: { $exists: false } },
                    { authorId: null },
                    { authorId: { $nin: excludedUserIds.map(id => new mongoose.Types.ObjectId(id)) } }
                ]
            });
        }

        if (blockedOrMutedIds.length > 0) {
            query.$and.push({
                $or: [
                    { authorId: { $exists: false } },
                    { authorId: null },
                    { authorId: { $nin: blockedOrMutedIds.map(id => new mongoose.Types.ObjectId(id)) } }
                ]
            });
        }

        const posts = await Post.find(query).sort({ score: -1, createdAt: -1 }).limit(limit + 1).lean();
        const hasMore = posts.length > limit;
        const result = hasMore ? posts.slice(0, limit) : posts;

        // Strip any identifying info before sending — extra safety layer
        const sanitized = result.map(p => ({
            ...p,
            user: {
                _id: null, // never reveal real _id
                fullname: 'Anonymous',
                profile_picture: USER_DEFAULT_IMAGE,
            },
        }));

        res.status(200).json({ posts: sanitized, nextCursor: hasMore ? result[result.length - 1]._id : null, hasMore });
    } catch (error) {
        console.error('[Confessions Feed Error]', error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── EXPLORE (Mixed Content & Reels) ──────────────────────────────────────────
// ─── EXPLORE (Mixed Content & Reels) ──────────────────────────────────────────
// ─── EXPLORE (Mixed Content & Reels) ──────────────────────────────────────────
router.get("/explore-reels", softVerifyToken, async (req, res) => {
    const _tag = '[EXPLORE]';
    const limit = parseInt(req.query.limit) || 9;
    const cursor = req.query.cursor;

    try {
        const viewerId = req.userId;

        const viewerIdStr = viewerId ? viewerId.toString() : null;
        let followingIds = [];
        let excludedUserIds = [];

        if (viewerId) {
            const viewer = await User.findById(viewerId).select('following blockedUsers mutedUsers').lean();
            if (viewer) {
                followingIds = (viewer.following || []).map(id => id.toString());
                excludedUserIds = [
                    ...(viewer.blockedUsers || []),
                    ...(viewer.mutedUsers || []),
                    viewerId // Exclude self
                ].map(id => id.toString());
            }
        }

        // 2. Private user exclusion
        const privCacheKey = `private_users:excl:${viewerIdStr || 'anon'}`;
        let privateUserIdsExcluded;
        try {
            const cached = await redis.get(privCacheKey);
            if (cached) {
                privateUserIdsExcluded = JSON.parse(cached);
            } else {
                const privateUsers = await User.find({
                    isPrivate: true,
                    _id: { $nin: [...followingIds, viewerId].filter(Boolean) }
                }).select('_id').lean();
                privateUserIdsExcluded = privateUsers.map(u => u._id.toString());
                await redis.set(privCacheKey, JSON.stringify(privateUserIdsExcluded), 'EX', 60);
            }
        } catch (_) {
            privateUserIdsExcluded = [];
        }

        // 3. Fetch Candidate Pool
        // We fetch a larger pool (100) to allow for ranking and Bloom Filter exclusion
        const query = {
            'user._id': { $nin: [...excludedUserIds, ...privateUserIdsExcluded].filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id)) },
            isAnonymous: { $ne: true },
            video: { $ne: null },
            deletedAt: null
        };

        if (cursor) {
            query._id = { $lt: cursor };
        }

        const candidates = await Post.find(query)
            .sort({ _id: -1 })
            .limit(100)
            .lean();

        if (candidates.length === 0) {
            return res.status(200).json({ posts: [], nextCursor: null, hasMore: false });
        }

        // 3b. Deduplicate Candidates by Video URL (if duplicate uploads exist)
        const uniqueCandidates = [];
        const seenUrls = new Set();
        for (const cand of candidates) {
            if (cand.video) {
                if (seenUrls.has(cand.video)) continue;
                seenUrls.add(cand.video);
            }
            uniqueCandidates.push(cand);
        }

        // 4. Bloom Filter Exclusion (Seen Posts)
        let filteredCandidates = uniqueCandidates;
        if (viewerIdStr && redis.status !== 'disabled') {
            try {
                const seenFilter = new RedisBloomFilter(`bf:seen:${viewerIdStr}`);
                const seenChecks = await seenFilter.mightContainMultiple(uniqueCandidates.map(p => p._id.toString()));
                filteredCandidates = uniqueCandidates.filter((_, i) => !seenChecks[i]);

                // If we filtered out too many, fall back to some seen ones to keep the feed moving
                if (filteredCandidates.length < limit && uniqueCandidates.length >= limit) {
                    filteredCandidates = uniqueCandidates;
                }
            } catch (bfErr) {
                console.warn(`${_tag} Bloom Filter check failed:`, bfErr.message);
                filteredCandidates = candidates;
            }
        }

        // 5. Ranking & Randomization (P2 — video-aware scoring)
        let ranked = filteredCandidates;
        try {
            const { UserInterest, PostVector, VideoStats } = require("../models/Recommendation");
            const interest = viewerIdStr ? await UserInterest.findOne({ userId: viewerIdStr }).lean() : null;
            const postVecs = await PostVector.find({ postId: { $in: filteredCandidates.map(c => c._id) } }).lean();
            const vecMap = new Map(postVecs.map(v => [v.postId.toString(), v.vector]));

            // Fetch video watch-through rates from VideoStats (P9)
            const videoStatsDocs = await VideoStats.find({ postId: { $in: filteredCandidates.map(c => c._id) } }).lean();
            const videoStatsMap = new Map(videoStatsDocs.map(s => [s.postId.toString(), s]));

            const userVec = interest?.interestVector;
            const userMag = userVec ? Math.sqrt(userVec.reduce((sum, val) => sum + val * val, 0)) : 0;
            const dislikedCats = new Set(interest?.dislikedCategories || []);

            ranked = filteredCandidates.map(post => {
                const isVideo = !!post.video;

                // Cosine similarity between user interest vector and post embedding
                let similarity = 0;
                const postVec = vecMap.get(post._id.toString());
                if (postVec && userMag) {
                    const dotProduct = userVec.reduce((sum, val, i) => sum + val * (postVec[i] || 0), 0);
                    const postMag = Math.sqrt(postVec.reduce((sum, val) => sum + val * val, 0));
                    similarity = postMag ? dotProduct / (userMag * postMag) : 0;
                }

                const hoursOld = Math.max(0.1, (Date.now() - new Date(post.createdAt)) / (1000 * 60 * 60));

                // Reels use a longer 72h half-life — a great reel stays relevant longer
                const recencyHalfLife = isVideo ? 72 : 48;
                const recency = Math.exp(-hoursOld / recencyHalfLife);

                const likesCount = post.likes?.length || 0;
                const popularity = Math.min(1, likesCount / 100);

                // Viral velocity: likes per hour since posting (normalized)
                const viralVelocity = Math.min(1, (likesCount / hoursOld) / 10);

                // P9: Watch-through rate from VideoStats
                const vsDoc = isVideo ? videoStatsMap.get(post._id.toString()) : null;
                const watchThroughRate = vsDoc ? Math.min(1, vsDoc.watchThroughRate || 0) : 0;

                // P8: Disliked category penalty
                const categoryPenalty = dislikedCats.has(post.category) ? 0.4 : 1.0;

                // Separate weight sets for video (reels) vs image posts
                let score;
                if (isVideo) {
                    score = (
                        0.28 * similarity +
                        0.18 * recency +
                        0.15 * popularity +
                        0.22 * viralVelocity +
                        0.12 * watchThroughRate +
                        0.05 * Math.random()
                    );
                } else {
                    score = (
                        0.40 * similarity +
                        0.25 * recency +
                        0.20 * popularity +
                        0.10 * viralVelocity +
                        0.05 * Math.random()
                    );
                }

                return { ...post, _score: score * categoryPenalty };
            });

            ranked.sort((a, b) => b._score - a._score);
        } catch (recErr) {
            console.warn(`${_tag} Recommendation failed, using chronological with jitter:`, recErr.message);
            ranked = filteredCandidates.map(p => ({ ...p, _score: Math.random() }));
            ranked.sort((a, b) => b._score - a._score);
        }

        // 6. Final Result (limit to 10 as requested)
        const result = ranked.slice(0, limit);
        const hasMore = candidates.length > limit;
        const nextCursor = candidates.length > 0 ? candidates[candidates.length - 1]._id : null;

        // Fetch presence
        const uniqueUserIds = [...new Set(result.map(p => p.user._id.toString()))];
        const usersWithPresence = await User.find({ _id: { $in: uniqueUserIds } }).select('isOnline');
        const presenceMap = {};
        usersWithPresence.forEach(u => presenceMap[u._id.toString()] = u.isOnline);

        const resultWithPresence = result.map(p => {
            if (p.user) p.user.isOnline = presenceMap[p.user._id.toString()] || false;
            return p;
        });

        const finalPosts = resultWithPresence.map(p => sanitizeAnonymousPost(p, viewerId));
        res.status(200).json({
            posts: finalPosts,
            nextCursor,
            hasMore
        });
    } catch (error) {
        console.error(`${_tag} CRITICAL ERROR:`, error);
        // Minimal Fallback
        try {
            const fallback = await Post.find({ video: { $ne: null }, isAnonymous: { $ne: true } })
                .sort({ _id: -1 })
                .limit(limit)
                .lean();
            return res.status(200).json({ posts: fallback, hasMore: false, isFallback: true, error: "An unexpected error occurred" });
        } catch (innerErr) {
            console.error(`${_tag} Fallback also failed:`, innerErr.message);
            res.status(500).json({ error: "Service unavailable", details: "Could not fetch fallback content" });
        }
    }
});

module.exports = router;
module.exports.setIo = setIo;