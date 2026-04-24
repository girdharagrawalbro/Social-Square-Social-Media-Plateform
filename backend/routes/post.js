const express = require('express');
const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Category = require("../models/Category");
const Group = require("../models/Group");
const { publish } = require('../lib/pubsub');
const redis = require('../lib/redis');
const notificationUtils = require('../lib/notification.js');
const verifyToken = require('../middleware/Verifytoken');
const contentFilter = require('../middleware/contentFilter');
const { publishEvent } = require("../services/recommendationPublisher");
const { updateGamification } = require('../lib/gamification');
const jwt = require('jsonwebtoken');

const router = express.Router();


// io is injected from index.js
let _io;
function setIo(io) { _io = io; }

// ─── VIEW (PUBLIC) ────────────────────────────────────────────────────────────
router.post("/view/:postId", async (req, res) => {
    try {
        const { postId } = req.params;

        // Idempotency guard: avoid counting repeated rapid views from same client
        // Key: view:{postId}:{userOrIp} with short TTL
        const TTL_SECONDS = Number(process.env.VIEW_IDEMPOTENCY_SECONDS || 60);

        // Try to determine user identity from bearer token if present (optional)
        let viewerId = null;
        try {
            const auth = req.headers.authorization || '';
            if (auth.startsWith('Bearer ')) {
                const token = auth.split(' ')[1];
                const payload = jwt.verify(token, process.env.JWT_SECRET);
                viewerId = payload && (payload.userId || payload.id || payload._id) ? (payload.userId || payload.id || payload._id) : null;
            }
        } catch (e) {
            // ignore token errors — fall back to IP
            viewerId = null;
        }

        const clientId = viewerId || (req.ip || req.connection && req.connection.remoteAddress || 'anonymous');
        const redisKey = `view:${postId}:${clientId}`;
        let setResult = 'OK';

        // SET NX with EX — returns 'OK' if set, null if key exists
        if (redis.status !== 'disabled') {
            setResult = await redis.set(redisKey, '1', 'EX', TTL_SECONDS, 'NX');
        }

        if (setResult === 'OK') {
            await Post.findByIdAndUpdate(postId, { $inc: { views: 1 } });
            return res.status(200).json({ success: true, counted: true });
        } else {
            // Recently counted — skip increment
            return res.status(200).json({ success: true, counted: false });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── VOTE (PROTECTED) ────────────────────────────────────────────────────────
router.post("/vote", verifyToken, async (req, res) => {
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
    } catch (e) { res.status(500).json({ error: e.message }); }
});

function computeScore(post, followingIds = []) {
    const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
    return (post.likes?.length || 0) * 2 + (post.comments?.length || 0) * 3
        + (followingIds.includes(post.user._id.toString()) ? 20 : 0)
        + Math.max(0, 50 - ageHours * 0.5);
}

// ─── CREATE (PROTECTED + FILTERED) ───────────────────────────────────────────
router.post("/create", verifyToken, contentFilter, async (req, res) => {
    try {
        const {
            caption, category, imageURLs, videoURL, location, music,
            isAnonymous, expiresAt, unlocksAt, isCollaborative,
            collaboratorIds, voiceNoteUrl, voiceNoteDuration, mood,
            isAiGenerated, groupId, poll, videoThumbnail
        } = req.body;
        const loggedUserId = req.userId; // Secure: from token

        // DEBUG: Log video URL received
        if (videoURL) {
            console.log('✅ Backend received videoURL:', videoURL.substring(0, 50) + '...');
        }

        if (!loggedUserId || !category) return res.status(400).json({ message: "loggedUserId and category are required." });

        const userDetails = await User.findById(loggedUserId).select('username fullname profile_picture followers');
        if (!userDetails) return res.status(404).json({ message: "User not found." });

        let collaborators = [];
        if (isCollaborative && Array.isArray(collaboratorIds) && collaboratorIds.length > 0) {
            const collabUsers = await User.find({ _id: { $in: collaboratorIds } }).select('fullname profile_picture');
            collaborators = collabUsers.map(u => ({ userId: u._id, fullname: u.fullname, profile_picture: u.profile_picture, status: 'pending' }));
        }

        const newPost = new Post({
            caption, category,
            image_urls: Array.isArray(imageURLs) ? imageURLs : [],
            video: videoURL || null,
            videoThumbnail: videoThumbnail || null,
            user: isAnonymous
                ? { _id: userDetails._id, fullname: 'Anonymous', profile_picture: 'https://th.bing.com/th/id/OIP.S171c9HYsokHyCPs9brbPwHaGP?rs=1&pid=ImgDetMain' }
                : { _id: userDetails._id, fullname: userDetails.fullname, profile_picture: userDetails.profile_picture },
            location: location || {}, music: music || {},
            isAnonymous: !!isAnonymous,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            unlocksAt: unlocksAt ? new Date(unlocksAt) : null,
            isCollaborative: !!isCollaborative,
            collaborators,
            voiceNote: voiceNoteUrl ? { url: voiceNoteUrl, duration: voiceNoteDuration || null } : {},
            mood: mood || null,
            isAiGenerated: !!isAiGenerated,
            groupId: groupId || null,
            poll: poll || null
        });
        await newPost.save();

        // DEBUG: Log saved post video field
        console.log('✅ Post saved with video field:', newPost.video ? 'YES' : 'NO (null or undefined)');

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

        // Anonymous posts do NOT go to followers' feeds
        if (!isAnonymous && !unlocksAt && _io && userDetails.followers?.length > 0) {
            userDetails.followers.forEach(async (followerId) => {
                _io.to(followerId.toString()).emit('newFeedPost', newPost);

                // Also create a notification
                await notificationUtils.createNotification({
                    recipientId: followerId,
                    sender: { id: userDetails._id, fullname: userDetails.fullname, profile_picture: userDetails.profile_picture },
                    type: 'new_post',
                    postId: newPost._id,
                    thumbnail: newPost.image_urls?.[0],
                    url: `/post/${newPost._id}`,
                });
            });
        }

        if (isAnonymous && _io) {
            _io.emit('newConfessionPost', newPost);
        }

        if (!isAnonymous) {
            publish('posts.created', { id: newPost._id, user: newPost.user, category: newPost.category })
                .catch(err => console.warn('[NATS]:', err.message));
        }

        // ✅ Publish recommendation event
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

        // ✅ Update Gamification
        const rewards = await updateGamification(loggedUserId, 'post');
        if (rewards && _io) {
            _io.to(loggedUserId.toString()).emit('levelUpdate', rewards);
        }

        // Detect if this is the user's first post
        const postCount = await Post.countDocuments({ 'user._id': loggedUserId });
        const isFirstPost = postCount === 1;

        res.status(201).json({ ...newPost.toObject(), rewards, isFirstPost });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ─── ACCEPT COLLABORATION (PROTECTED) ──────────────────────────────────────────
router.post("/collaborate/accept", verifyToken, async (req, res) => {
    try {
        const { postId, contribution } = req.body;
        const userId = req.userId;
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found." });
        const idx = post.collaborators.findIndex(c => c.userId.toString() === userId);
        if (idx === -1) return res.status(403).json({ message: "Not a collaborator." });
        post.collaborators[idx].status = 'accepted';
        if (contribution) post.collaborators[idx].contribution = contribution;
        await post.save();
        if (_io) _io.to(post.user._id.toString()).emit('collaborationAccepted', { postId, userId });
        res.status(200).json(post);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ─── DECLINE COLLABORATION (PROTECTED) ───────────────────────────────────────────
router.post("/collaborate/decline", verifyToken, async (req, res) => {
    try {
        const { postId } = req.body;
        const userId = req.userId;
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found." });
        const idx = post.collaborators.findIndex(c => c.userId.toString() === userId);
        if (idx !== -1) { post.collaborators[idx].status = 'declined'; await post.save(); }
        res.status(200).json({ message: "Declined." });
    } catch (error) { res.status(500).json({ error: error.message }); }
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
        });
        res.status(200).json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── MY COLLABORATIONS ────────────────────────────────────────────────────────
router.get("/collaborate/mine/:userId", verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;
        // Optimization: user can see their own collaborations or those they are part of
        // We still allow viewing others if the post is public, but let's restrict to 'mine' as requested by the route name
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
        }).sort({ createdAt: -1 });
        res.status(200).json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── UPDATE (PROTECTED) ──────────────────────────────────────────────────────────
router.put("/update/:postId", verifyToken, async (req, res) => {
    try {
        const { caption, category } = req.body;
        const userId = req.userId;
        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ message: "Post not found." });
        if (post.user._id.toString() !== userId) return res.status(403).json({ message: "Unauthorized." });
        if (caption) post.caption = caption;
        if (category) post.category = category;
        await post.save();

        // ✅ Notify all users about post update
        if (_io) _io.emit('postUpdated', { postId: post._id, caption: post.caption, category: post.category });

        res.status(200).json(post);
    } catch (error) { res.status(500).json({ message: "Internal Server Error" }); }
});

// ─── DELETE (PROTECTED) ──────────────────────────────────────────────────────────
router.delete("/delete/:postId", verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ message: "Post not found." });
        if (post.user._id.toString() !== userId) return res.status(403).json({ message: "Unauthorized." });
        await Post.findByIdAndDelete(req.params.postId);

        // ✅ Notify all users to remove post from feed
        if (_io) _io.emit('postDeleted', { postId: req.params.postId });

        res.status(200).json({ message: "Post deleted.", postId: req.params.postId });
    } catch (error) { res.status(500).json({ message: "Internal Server Error" }); }
});

// ─── FEED ─────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const cursor = req.query.cursor;
        const userId = req.query.userId;
        let followingIds = [], userCategories = [], excludedUserIds = [];
        if (userId) {
            const user = await User.findById(userId).select('following blockedUsers mutedUsers');
            if (user) {
                followingIds = user.following.map(id => id.toString());
                excludedUserIds = [
                    ...(user.blockedUsers || []),
                    ...(user.mutedUsers || [])
                ].map(id => id.toString());

                // Also find users who have blocked the current user
                const blockers = await User.find({ blockedUsers: userId }).select('_id');
                const blockerIds = blockers.map(b => b._id.toString());
                // Exclude blockers + current user's own posts from feed results
                excludedUserIds = [...new Set([...excludedUserIds, ...blockerIds, userId.toString()])];
            }
            const likedPosts = await Post.find({ likes: userId }).select('category').limit(20);
            userCategories = [...new Set(likedPosts.map(p => p.category))];
        }
        // 🔒 Privacy Guard: Exclude private users unless followed
        let privateUserIdsExcluded = [];
        const privateUsers = await User.find({
            isPrivate: true,
            _id: { $nin: [...followingIds, userId].filter(Boolean) }
        }).select('_id').lean();
        privateUserIdsExcluded = privateUsers.map(u => u._id.toString());

        excludedUserIds = [...new Set([...excludedUserIds, ...privateUserIdsExcluded])];

        // Exclude anonymous posts from normal feed — they appear in confessions feed only
        // Also exclude time-locked posts that haven't unlocked yet
        // ALSO: Exclude blocked/muted/private users
        const query = {
            isAnonymous: { $ne: true },
            'user._id': { $nin: excludedUserIds },
            $or: [{ unlocksAt: null }, { unlocksAt: { $lte: new Date() } }],
            ...(cursor ? { _id: { $lt: cursor } } : {}),
        };
        const posts = await Post.find(query).sort({ _id: -1 }).limit(limit * 3).lean();

        // Split into posts from followed users and others (suggestions)
        const followingPosts = [];
        const suggestionPosts = [];

        for (const post of posts) {
            if (followingIds.includes(post.user._id.toString())) followingPosts.push(post);
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

        // Compose final feed by interleaving following and suggestions.
        // Pattern: 2 following posts, then 1 suggestion (approx 70% following).
        const final = [];
        let iF = 0, iS = 0;
        while (final.length < limit && (iF < followingPosts.length || iS < suggestionPosts.length)) {
            const pos = final.length % 3;
            if (pos !== 2) {
                // prefer following
                if (iF < followingPosts.length) { final.push(followingPosts[iF++]); continue; }
                if (iS < suggestionPosts.length) { final.push(suggestionPosts[iS++]); continue; }
            } else {
                // prefer suggestion at every 3rd slot
                if (iS < suggestionPosts.length) { final.push(suggestionPosts[iS++]); continue; }
                if (iF < followingPosts.length) { final.push(followingPosts[iF++]); continue; }
            }
        }
        const result = final.slice(0, limit);

        // Fetch fresh presence for all users in the feed
        const uniqueUserIds = [...new Set(result.map(p => p.user._id.toString()))];
        const usersWithPresence = await User.find({ _id: { $in: uniqueUserIds } }).select('isOnline');
        const presenceMap = {};
        usersWithPresence.forEach(u => presenceMap[u._id.toString()] = u.isOnline);

        // Attach presence to results
        const resultWithPresence = result.map(p => {
            const po = p.toObject ? p.toObject() : p;
            if (po.user) {
                po.user.isOnline = presenceMap[po.user._id.toString()] || false;
            }
            return po;
        });

        const hasMore = posts.length >= limit;
        const nextCursor = result.length > 0 ? result[result.length - 1]._id : null;
        res.status(200).json({ posts: resultWithPresence, nextCursor, hasMore });
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── USER POSTS ───────────────────────────────────────────────────────────────
router.get("/user/:userId", async (req, res) => {
    try {
        // Enforce privacy: extract viewer ID from token if present
        let viewerId = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                viewerId = decoded.userId || decoded.id || decoded._id;
            } catch (err) { }
        }

        const ownerId = req.params.userId;
        const postOwner = await User.findById(ownerId).select('isPrivate followers').lean();

        if (postOwner && postOwner.isPrivate) {
            const isOwner = viewerId && viewerId.toString() === ownerId;
            const isFollower = viewerId && postOwner.followers?.some(f => f.toString() === viewerId.toString());

            if (!isOwner && !isFollower) {
                return res.status(200).json({ posts: [], nextCursor: null, hasMore: false, isPrivate: true });
            }
        }

        const limit = parseInt(req.query.limit) || 12;
        const cursor = req.query.cursor;
        // Show all posts where user is owner OR an accepted collaborator
        const query = {
            $or: [
                { 'user._id': req.params.userId },
                {
                    collaborators: {
                        $elemMatch: {
                            userId: req.params.userId,
                            status: 'accepted'
                        }
                    }
                }
            ],
            ...(cursor ? { _id: { $lt: cursor } } : {})
        };
        const posts = await Post.find(query).sort({ _id: -1 }).limit(limit + 1);
        const hasMore = posts.length > limit;
        const result = hasMore ? posts.slice(0, limit) : posts;
        res.status(200).json({ posts: result, nextCursor: hasMore ? result[result.length - 1]._id : null, hasMore });
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── SAVE / UNSAVE (PROTECTED) ───────────────────────────────────────────────────
router.post("/save", verifyToken, async (req, res) => {
    try {
        const { postId } = req.body;
        const userId = req.userId;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found.' });
        const alreadySaved = (user.savedPosts || []).some(id => id.toString() === postId);
        if (alreadySaved) {
            await User.findByIdAndUpdate(userId, { $pull: { savedPosts: postId } });
            return res.status(200).json({ saved: false });
        } else {
            await User.findByIdAndUpdate(userId, { $addToSet: { savedPosts: postId } });

            // ✅ Publish recommendation event
            const post = await Post.findById(postId).select('category tags');
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

            return res.status(200).json({ saved: true });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/saved/:userId", verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;
        if (String(userId) !== String(req.userId)) return res.status(403).json({ error: 'Unauthorized' });

        const user = await User.findById(userId).select('savedPosts');
        if (!user) return res.status(404).json({ message: 'User not found.' });
        const posts = await Post.find({ _id: { $in: user.savedPosts } }).sort({ createdAt: -1 });
        res.status(200).json(posts);
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── REACT (PROTECTED) ────────────────────────────────────────────────────────
router.post("/react", verifyToken, async (req, res) => {
    try {
        const { postId, emoji } = req.body;
        const userId = req.userId;
        if (!postId || !emoji) return res.status(400).json({ message: 'PostId and emoji required.' });

        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post not found.' });

        const existingIdx = (post.reactions || []).findIndex(r => r.userId?.toString() === userId);

        if (existingIdx !== -1) {
            if (post.reactions[existingIdx].emoji === emoji) {
                // Toggle off if same emoji
                post.reactions.splice(existingIdx, 1);
                // Also remove from likes if it was there
                post.likes = post.likes.filter(id => id.toString() !== userId);
            } else {
                // Change emoji
                post.reactions[existingIdx].emoji = emoji;
                // Ensure it's in likes for backward compatibility/quick counts
                if (!post.likes.includes(userId)) post.likes.push(userId);
            }
        } else {
            // New reaction
            post.reactions.push({ userId, emoji });
            if (!post.likes.includes(userId)) post.likes.push(userId);
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

        // ✅ Update Gamification
        const rewards = await updateGamification(userId, 'reaction');
        if (rewards && _io) _io.to(userId.toString()).emit('levelUpdate', rewards);

        res.status(200).json({ ...post.toObject(), rewards });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PULSE / TRENDING ────────────────────────────────────────────────────────
router.get("/trending", async (req, res) => {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // 1. Trending Categories
        const categories = await Post.aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo }, isAnonymous: { $ne: true } } },
            { $group: { _id: '$category', postCount: { $sum: 1 }, totalLikes: { $sum: { $size: '$likes' } } } },
            { $sort: { totalLikes: -1, postCount: -1 } },
            { $limit: 8 }
        ]);

        // 2. Trending Hashtags (Manual extraction from captions)
        const postsWithHashtags = await Post.find({
            createdAt: { $gte: sevenDaysAgo },
            isAnonymous: { $ne: true },
            caption: { $regex: /#/ }
        }).select('caption');

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
            { $group: { _id: '$user._id', totalLikes: { $sum: { $size: '$likes' } }, postCount: { $sum: 1 } } },
            { $sort: { totalLikes: -1 } },
            { $limit: 5 }
        ]);

        const topUserIds = topUsersAgg.map(u => u._id);
        const topUsersInfo = await User.find({ _id: { $in: topUserIds } }).select('fullname username profile_picture followers isOnline');

        const topUsers = topUsersAgg.map(u => {
            const info = topUsersInfo.find(ui => ui._id.toString() === u._id.toString());
            return {
                ...u,
                user: info
            };
        });

        res.status(200).json({ categories, hashtags, topUsers });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ─── LIKE (PROTECTED) ─────────────────────────────────────────────────────────
router.post("/like", verifyToken, async (req, res) => {
    try {
        const { postId } = req.body;
        const userId = req.userId;
        if (!postId) return res.status(400).json({ message: 'PostId required.' });
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post not found.' });
        if (!(post.likes || []).some(id => id.toString() === userId)) {
            post.likes.push(userId);
            // Default heart reaction for legacy like
            post.reactions.push({ userId, emoji: '❤️' });
            post.score = computeScore(post);
            await post.save();

            // ✅ Broadcast like update to all connected users
            if (_io) _io.emit('postLiked', { postId, userId, likesCount: post.likes.length });

            // Create notification for post owner
            const sender = await User.findById(userId).select('fullname profile_picture').lean();
            if (sender) {
                await notificationUtils.createNotification({
                    recipientId: post.user._id,
                    sender: { id: userId, fullname: sender.fullname, profile_picture: sender.profile_picture },
                    type: 'like',
                    postId: post._id,
                    thumbnail: post.image_urls?.[0],
                    url: `/post/${post._id}`,
                });
            }

            // ✅ Publish recommendation event
            await publishEvent("user.activity.like", {
                userId,
                postId: post._id.toString(),
                action: "like",
                category: post.category || "",
                tags: post.tags || [],
                timestamp: Date.now() / 1000,
            });

            res.status(200).json({ success: true, post });
        } else { res.status(400).json({ message: "Already liked." }); }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── UNLIKE (PROTECTED) ───────────────────────────────────────────────────────
router.post("/unlike", verifyToken, async (req, res) => {
    try {
        const { postId } = req.body;
        const userId = req.userId;
        if (!postId) return res.status(400).json({ message: 'PostId required.' });
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post not found.' });
        if ((post.likes || []).some(id => id.toString() === userId)) {
            post.likes = post.likes.filter(id => id.toString() !== userId);
            // Also remove reaction
            post.reactions = post.reactions.filter(r => r.userId?.toString() !== userId);
            post.score = computeScore(post);
            await post.save();

            // ✅ Broadcast unlike update to all connected users
            if (_io) _io.emit('postUnliked', { postId, userId, likesCount: post.likes.length });

            res.status(200).json({ success: true, post });
        } else { res.status(400).json({ message: "Not liked." }); }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
router.get("/categories", async (req, res) => {
    try {
        const categories = await Category.find();
        res.status(200).json(categories);
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get('/comments', async (req, res) => {
    try {
        const { postId } = req.query;
        if (!postId || typeof postId !== 'string') return res.status(400).json({ error: 'postId required as query param' });

        // 1. Fetch post and owner to check privacy
        const post = await Post.findById(postId).select('user').lean();
        if (!post) return res.status(404).json({ error: 'Post not found' });

        // Extract viewerId
        let viewerId = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                viewerId = decoded.userId || decoded.id || decoded._id;
            } catch (err) { /* ignore */ }
        }

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
        const comments = await Comment.find({ postId, parentId: null }).sort({ createdAt: 1 }).lean();
        if (!comments.length) return res.status(200).json([]);

        // 2. Fetch all replies for these parents in one single query (Optimized)
        const parentIds = comments.map(c => c._id);
        const allReplies = await Comment.find({ parentId: { $in: parentIds } }).sort({ createdAt: 1 }).lean();

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

// ─── ADD COMMENT (PROTECTED + FILTERED) ───────────────────────────────────────
router.post('/comments/add', verifyToken, contentFilter, async (req, res) => {
    try {
        const { content, postId, user, parentId } = req.body;
        if (!content || !postId || !user) return res.status(400).json({ error: 'Invalid data' });

        const newComment = new Comment({ postId, content, user, parentId: parentId || null });
        await newComment.save();

        if (parentId) {
            await Comment.findByIdAndUpdate(parentId, { $push: { replies: newComment._id } });
        } else {
            const post = await Post.findById(postId);
            post.comments.push(newComment._id);
            post.score = computeScore(post);
            await post.save();
        }

        // ✅ Broadcast new comment to all users viewing this post
        if (_io) {
            _io.emit('newComment', {
                postId,
                comment: { ...newComment.toObject(), repliesList: [] },
                parentId: parentId || null,
                commentsCount: (await Post.findById(postId).select('comments'))?.comments?.length || 0,
            });
        }

        // Create notification for post owner or parent comment owner
        const targetRecipientId = parentId ? (await Comment.findById(parentId).select('user')).user?.id : (await Post.findById(postId).select('user')).user?._id;

        if (targetRecipientId) {
            const postForThumb = await Post.findById(postId).select('image_urls').lean();
            await notificationUtils.createNotification({
                recipientId: targetRecipientId,
                sender: { id: user.id || user._id, fullname: user.fullname, profile_picture: user.profile_picture },
                type: 'comment',
                postId: postId,
                thumbnail: postForThumb?.image_urls?.[0],
                message: { content: content.substring(0, 50) },
                url: `/post/${postId}`,
            });
        }

        // ✅ Update Gamification
        const rewards = await updateGamification(user.id || user._id, 'comment');
        if (rewards && _io) _io.to((user.id || user._id).toString()).emit('levelUpdate', rewards);

        return res.status(200).json({ ...newComment.toObject(), rewards });
    } catch (error) { return res.status(500).json({ error: 'Server error' }); }
});

// ─── DELETE COMMENT (PROTECTED) ───────────────────────────────────────────────
router.delete('/comments/:commentId', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const comment = await Comment.findById(req.params.commentId);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });
        if (comment.user._id.toString() !== userId) return res.status(403).json({ error: 'Unauthorized' });

        if (comment.parentId) {
            await Comment.findByIdAndUpdate(comment.parentId, { $pull: { replies: comment._id } });
        } else {
            await Post.findByIdAndUpdate(comment.postId, { $pull: { comments: comment._id } });
        }

        await Comment.deleteMany({ parentId: comment._id });
        await Comment.findByIdAndDelete(req.params.commentId);

        // ✅ Broadcast comment deletion
        if (_io) {
            _io.emit('commentDeleted', {
                commentId: req.params.commentId,
                postId: comment.postId,
                parentId: comment.parentId || null,
            });
        }

        res.status(200).json({ message: 'Comment deleted', commentId: req.params.commentId });
    } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

// ─── LIKE COMMENT (PROTECTED) ─────────────────────────────────────────────────
router.post('/comments/:commentId/like', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const comment = await Comment.findById(req.params.commentId);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });
        const liked = (comment.likes || []).some(id => id.toString() === userId);
        if (liked) {
            await Comment.findByIdAndUpdate(req.params.commentId, { $pull: { likes: userId } });
        } else {
            await Comment.findByIdAndUpdate(req.params.commentId, { $addToSet: { likes: userId } });
        }

        // ✅ Broadcast comment like
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
router.get("/detail/:postId", async (req, res) => {
    try {
        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ message: "Post not found." });

        // ✅ Extract userId from token if possible
        let viewerId = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                viewerId = decoded.userId || decoded.id || decoded._id;
            } catch (err) { /* ignore invalid token for detail view */ }
        }

        // ✅ Privacy Check
        const ownerId = post.user._id.toString();
        const postOwner = await User.findById(ownerId).select('isPrivate followers').lean();

        if (postOwner && postOwner.isPrivate) {
            const isOwner = viewerId && viewerId.toString() === ownerId;
            const isFollower = viewerId && postOwner.followers?.some(f => f.toString() === viewerId.toString());
            const isCollaborator = viewerId && post.collaborators?.some(c => c.userId?.toString() === viewerId.toString() && c.status === 'accepted');

            if (!isOwner && !isFollower && !isCollaborator) {
                return res.status(403).json({
                    message: "This account is private. Follow to see their posts.",
                    isPrivate: true,
                    owner: post.user
                });
            }
        }

        // ✅ Publish recommendation event
        await publishEvent("user.activity.view", {
            userId: viewerId,
            postId: post._id.toString(),
            action: "view",
            category: post.category || "",
            tags: post.tags || [],
            timestamp: Date.now() / 1000,
        });

        res.status(200).json(post);
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── CONFESSIONS FEED ────────────────────────────────────────────────────────
// Anonymous posts only — identity is never revealed, sorted by score
router.get("/confessions", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const cursor = req.query.cursor;
        const query = {
            isAnonymous: true,
            $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
            ...(cursor ? { _id: { $lt: cursor } } : {}),
        };
        const posts = await Post.find(query).sort({ score: -1, _id: -1 }).limit(limit + 1);
        const hasMore = posts.length > limit;
        const result = hasMore ? posts.slice(0, limit) : posts;

        // Strip any identifying info before sending — extra safety layer
        const sanitized = result.map(p => ({
            ...p.toObject(),
            user: {
                _id: null, // never reveal real _id
                fullname: 'Anonymous',
                profile_picture: 'https://th.bing.com/th/id/OIP.S171c9HYsokHyCPs9brbPwHaGP?rs=1&pid=ImgDetMain',
            },
        }));

        res.status(200).json({ posts: sanitized, nextCursor: hasMore ? result[result.length - 1]._id : null, hasMore });
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── EXPLORE REELS (Infinite Scroll) ──────────────────────────────────────────
router.get("/explore-reels", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 12;
        const cursor = req.query.cursor;

        // 🔒 Privacy Guard: Exclude private users
        const privateUsers = await User.find({ isPrivate: true }).select('_id').lean();
        const privateUserIds = privateUsers.map(u => u._id.toString());

        const query = { video: { $ne: null }, 'user._id': { $nin: privateUserIds } };
        if (cursor) {
            query._id = { $lt: cursor };
        }

        const posts = await Post.find(query)
            .sort({ _id: -1 }) // Use _id for reliable cursor-based pagination
            .limit(limit + 1);

        const hasMore = posts.length > limit;
        const result = hasMore ? posts.slice(0, limit) : posts;
        const nextCursor = hasMore ? result[result.length - 1]._id : null;

        res.status(200).json({
            posts: result,
            nextCursor,
            hasMore
        });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
module.exports.setIo = setIo;
