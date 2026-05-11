const express = require('express');
const mongoose = require('mongoose');

const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Category = require("../models/Category");
const Group = require("../models/Group");
const { publish } = require('../lib/pubsub');
const redis = require('../lib/redis');
const notificationUtils = require('../lib/notification.js');
const verifyToken = require('../middleware/Verifytoken');
const softVerifyToken = require('../middleware/softVerifyToken');
const contentFilter = require('../middleware/contentFilter');
const { publishEvent } = require("../services/recommendationPublisher");
const { checkPostPrivacy } = require('../utils/privacy');
const { updateGamification } = require('../lib/gamification');
const jwt = require('jsonwebtoken');
const { hashValue } = require('../utils/authSecurity');
const LoginSession = require('../models/LoginSession');
const RedisBloomFilter = require('../lib/bloomFilter');
const { getOwnerToken, sanitizePost } = require('../utils/privacy');

const router = express.Router();
const ANONYMOUS_USER_ID = "600000000000000000000000"; // Constant dummy ID for anonymous posts


// io is injected from index.js
let _io;
function setIo(io) { _io = io; }

// ─── VIEW (PUBLIC) ────────────────────────────────────────────────────────────
router.post("/view/:postId", softVerifyToken, async (req, res) => {
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
    } catch (e) { res.status(500).json({ error: "Internal Server Error" }); }
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
                ? { 
                    _id: ANONYMOUS_USER_ID, 
                    fullname: 'Anonymous', 
                    profile_picture: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' 
                  }
                : { _id: userDetails._id, fullname: userDetails.fullname, profile_picture: userDetails.profile_picture },
            location: location || {}, music: music || {},
            isAnonymous: !!isAnonymous,
            ownerToken: isAnonymous ? getOwnerToken(loggedUserId) : null,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            unlocksAt: unlocksAt ? new Date(unlocksAt) : null,
            isCollaborative: !!isCollaborative,
            collaborators,
            voiceNote: voiceNoteUrl ? { url: voiceNoteUrl, duration: voiceNoteDuration || null } : {},
            mood: mood || null,
            isAiGenerated: !!isAiGenerated,
            groupId: groupId || null,
            poll: poll || null,
            authorId: loggedUserId // Track real author
        });
        await newPost.save();
        await User.findByIdAndUpdate(loggedUserId, { $inc: { postsCount: 1 } });

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

        // Logic for followers' feed and notifications moved to postSubscriber (via NATS posts.created event)

        if (isAnonymous) {
            // Rate Limit Check: 5 confessions per hour
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

            if (_io) {
                // Room-based emit: only users viewing confessions tab receive this
                _io.to('confessions').emit('newConfessionPost', newPost);
            }
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
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
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
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
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
router.put("/update/:postId", verifyToken, async (req, res) => {
    try {
        const { caption, category } = req.body;
        const userId = req.userId;
        const post = await Post.findById(req.params.postId).select('+ownerToken');
        if (!post) return res.status(404).json({ message: "Post not found." });

        let isOwner = false;
        if (post.isAnonymous) {
            isOwner = post.ownerToken === getOwnerToken(userId);
        } else {
            isOwner = post.user._id.toString() === userId.toString();
        }

        if (!isOwner) return res.status(403).json({ message: "Unauthorized." });
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
        const post = await Post.findById(req.params.postId).select('+ownerToken +authorId');
        if (!post) return res.status(404).json({ message: "Post not found." });

        const user = await User.findById(userId).select('isAdmin').lean();
        
        let isOwner = false;
        if (post.isAnonymous) {
            isOwner = post.ownerToken === getOwnerToken(userId);
        } else {
            isOwner = post.authorId.toString() === userId.toString();
        }
        
        const isAdmin = user && user.isAdmin;

        if (!isOwner && !isAdmin) return res.status(403).json({ message: "Unauthorized." });
        await Post.findByIdAndUpdate(req.params.postId, { $set: { deletedAt: new Date() } });
        
        // Decrement real author's post count
        await User.findByIdAndUpdate(post.authorId, { $inc: { postsCount: -1 } });

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
            'user._id': { $nin: excludedUserIds.filter(id => id && id.length === 24).map(id => new mongoose.Types.ObjectId(id)) },
            $or: [{ unlocksAt: null }, { unlocksAt: { $lte: new Date() } }],
            ...(cursor ? { _id: { $lt: cursor } } : {}),
        };
        // Fetch a larger batch since we might filter some out below
        const posts = await Post.find(query).sort({ _id: -1 }).limit(limit * 4).lean().maxTimeMS(5000);

        // 🔒 Privacy Guard: Find any private users among the fetched posts that we don't follow
        const fetchedUserIds = [...new Set(posts.map(p => p.user && p.user._id ? p.user._id.toString() : null).filter(Boolean))];
        const usersToCheck = fetchedUserIds.filter(id => id !== userId && !followingIds.includes(id));

        let privateUserIdsExcluded = [];
        if (usersToCheck.length > 0) {
            const privateUsers = await User.find({
                _id: { $in: usersToCheck },
                isPrivate: true
            }).select('_id').lean();
            privateUserIdsExcluded = privateUsers.map(u => u._id.toString());
        }

        // Filter out posts from those private users
        let filteredPosts = posts.filter(p => !privateUserIdsExcluded.includes(p.user._id.toString()));

        // NOTE: Bloom Filter (seen-post deduplication) is intentionally NOT applied to the main feed.
        // The main feed should always show posts from followed users, even if seen before.
        // Bloom Filter deduplication is appropriate for Explore/Recommendations only.

        // Split into posts from followed users and others (suggestions)
        const followingPosts = [];
        const suggestionPosts = [];

        for (const post of filteredPosts) {
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

        // FIX #1: hasMore should reflect whether filteredPosts had more than `limit` items
        // (i.e. there are more pages to fetch), not compare against the raw DB batch size
        const hasMore = filteredPosts.length > limit;
        const nextCursor = result.length > 0 ? result[result.length - 1]._id : null;

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

        // NOTE: We no longer add feed posts to the Bloom Filter seen-set.
        // The Bloom Filter is reserved for the Explore/Recommendations engine.

        const finalPosts = resultWithPresence.map(p => sanitizePost(p, userId));
        res.status(200).json({ posts: finalPosts, nextCursor, hasMore });
    } catch (error) {
        console.error('[Feed] CRITICAL Error:', error.message);

        // 🛡️ Fail-Safe Fallback: Try a super-minimal query if the complex feed logic crashes/times out
        try {
            const simplePosts = await Post.find({ isAnonymous: { $ne: true } })
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
router.get("/user/:userId", softVerifyToken, async (req, res) => {
    try {
        const viewerId = req.userId; // Resolved by softVerifyToken middleware
        const ownerId = req.params.userId;
        
        if (!mongoose.Types.ObjectId.isValid(ownerId)) {
            return res.status(400).json({ posts: [], nextCursor: null, hasMore: false });
        }
        
        // Priority owner check - resolves identity before privacy check
        const isOwner = viewerId && viewerId.toString() === ownerId;

        const postOwner = await User.findById(ownerId).select('isPrivate followers').lean();
        if (!postOwner) return res.status(404).json({ message: "User not found" });

        const isFollower = viewerId && postOwner.followers?.some(f => f.toString() === viewerId.toString());

        if (postOwner.isPrivate && !isOwner && !isFollower) {
            return res.status(200).json({ posts: [], nextCursor: null, hasMore: false, isPrivate: true });
        }

        const limit = parseInt(req.query.limit) || 9;
        const cursor = req.query.cursor;
        // Show all posts where user is owner OR an accepted collaborator
        const query = {
            $or: [
                { 'user._id': ownerId },
                { 'user._id': new mongoose.Types.ObjectId(ownerId) },
                {
                    collaborators: {
                        $elemMatch: {
                            userId: ownerId,
                            status: 'accepted'
                        }
                    }
                },
                {
                    collaborators: {
                        $elemMatch: {
                            userId: new mongoose.Types.ObjectId(ownerId),
                            status: 'accepted'
                        }
                    }
                }
            ],
            ...(cursor ? { _id: { $lt: cursor } } : {}),
            ...(!isOwner ? { isAnonymous: { $ne: true } } : {})
        };
        const posts = await Post.find(query).sort({ _id: -1 }).limit(limit + 1).lean();
        const hasMore = posts.length > limit;
        const result = hasMore ? posts.slice(0, limit) : posts;
        const sanitized = result.map(p => sanitizePost(p, viewerId));
        res.status(200).json({ posts: sanitized, nextCursor: hasMore ? result[result.length - 1]._id : null, hasMore });
    } catch (error) {
        console.error('[Post Route] /user/:userId error:', error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── PUBLIC USER POSTS (Logged-out) ───────────────────────────────────────────
router.get("/public/user/:userId", async (req, res) => {
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
        const query = {
            $or: [
                { 'user._id': ownerId },
                {
                    collaborators: {
                        $elemMatch: {
                            userId: ownerId,
                            status: 'accepted'
                        }
                    }
                }
            ],
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
    } catch (e) { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/saved/:userId", verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;
        if (String(userId) !== String(req.userId)) return res.status(403).json({ error: 'Unauthorized' });

        const user = await User.findById(userId).select('savedPosts');
        if (!user) return res.status(404).json({ message: 'User not found.' });
        const posts = await Post.find({ _id: { $in: user.savedPosts } }).sort({ createdAt: -1 }).lean();
        const sanitized = posts.map(p => sanitizePost(p, req.userId));
        res.status(200).json(sanitized);
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

        // ✅ Update Gamification
        const rewards = await updateGamification(userId, 'reaction');
        if (rewards && _io) _io.to(userId.toString()).emit('levelUpdate', rewards);

        res.status(200).json({ ...post.toObject(), rewards });
    } catch (e) { res.status(500).json({ error: "Internal Server Error" }); }
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
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── LIKE (PROTECTED) ─────────────────────────────────────────────────────────
router.post("/like", verifyToken, async (req, res) => {
    try {
        const { postId } = req.body;
        const userId = req.userId;
        if (!postId) return res.status(400).json({ message: 'PostId required.' });
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post not found.' });

        const alreadyLiked = (post.likes || []).some(id => id.toString() === userId.toString());
        if (!alreadyLiked) {
            // Use atomic findOneAndUpdate to prevent race conditions and duplicate likes
            // Also ensure reactions are unique by userId
            const updatedPost = await Post.findOneAndUpdate(
                { _id: postId, likes: { $ne: userId } },
                {
                    $addToSet: { likes: userId },
                    $push: { reactions: { userId, emoji: '❤️' } }
                },
                { new: true }
            );

            if (!updatedPost) {
                return res.status(400).json({ message: "Already liked." });
            }

            updatedPost.score = computeScore(updatedPost);
            await updatedPost.save();

            // ✅ Broadcast like update to all connected users
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

            // ✅ Publish recommendation event
            await publishEvent("user.activity.like", {
                userId,
                postId: updatedPost._id.toString(),
                action: "like",
                category: updatedPost.category || "",
                tags: updatedPost.tags || [],
                timestamp: Date.now() / 1000,
            });

            res.status(200).json({ success: true, post: updatedPost });
        } else { res.status(400).json({ message: "Already liked." }); }
    } catch (e) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── UNLIKE (PROTECTED) ───────────────────────────────────────────────────────
router.post("/unlike", verifyToken, async (req, res) => {
    try {
        const { postId } = req.body;
        const userId = req.userId;
        if (!postId) return res.status(400).json({ message: 'PostId required.' });
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post not found.' });

        const alreadyLiked = (post.likes || []).some(id => id.toString() === userId.toString());
        if (alreadyLiked) {
            // Use atomic findOneAndUpdate to prevent race conditions and ensure clean removal
            const updatedPost = await Post.findOneAndUpdate(
                { _id: postId },
                {
                    $pull: {
                        likes: userId,
                        reactions: { userId: userId }
                    }
                },
                { new: true }
            );

            if (updatedPost) {
                updatedPost.score = computeScore(updatedPost);
                await updatedPost.save();

                // ✅ Broadcast unlike update to all connected users
                if (_io) _io.emit('postUnliked', { postId, userId, likesCount: updatedPost.likes.length });

                res.status(200).json({ success: true, post: updatedPost });
            } else {
                res.status(404).json({ message: "Post not found during update." });
            }
        } else {
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
                const hashedToken = hashValue(token);
                const session = await LoginSession.findOne({ accessToken: hashedToken });
                if (session && !session.isRevoked && session.expiresAt > new Date()) {
                    viewerId = session.userId;
                }
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

        // FIX #4: Combine into one query instead of two separate Post.findById calls
        const postData = await Post.findById(postId).select('comments image_urls user').lean();
        const commentsCount = postData?.comments?.length || 0;

        // ✅ Broadcast new comment to all users viewing this post
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
        const liked = (comment.likes || []).some(id => id.toString() === userId.toString());
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
router.get("/detail/:postId", softVerifyToken, checkPostPrivacy, async (req, res) => {
    try {
        const post = req.post; 
        const viewerId = req.userId;
        // Wait, checkPostPrivacy currently relies on req.userId being set.
        // I need to ensure it handles optional auth.


        // ✅ Publish recommendation event
        await publishEvent("user.activity.view", {
            userId: viewerId,
            postId: post._id.toString(),
            action: "view",
            category: post.category || "",
            tags: post.tags || [],
            timestamp: Date.now() / 1000,
        });

        const sanitized = sanitizePost(post.toObject(), viewerId);
        res.status(200).json(sanitized);
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── CONFESSIONS FEED ────────────────────────────────────────────────────────
// Anonymous posts only — identity is never revealed, sorted by score
router.get("/confessions", softVerifyToken, async (req, res) => {
    try {
        const viewerId = req.userId;
        const limit = parseInt(req.query.limit) || 9;
        const cursor = req.query.cursor;
        const query = {
            isAnonymous: true,
            deletedAt: null,
            $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
            ...(cursor ? { _id: { $lt: cursor } } : {}),
        };
        const posts = await Post.find(query).sort({ score: -1, _id: -1 }).limit(limit + 1).lean();
        const hasMore = posts.length > limit;
        const result = hasMore ? posts.slice(0, limit) : posts;

        // Strip any identifying info before sending — extra safety layer
        const sanitized = result.map(p => ({
            ...p,
            user: {
                _id: null, // never reveal real _id
                fullname: 'Anonymous',
                profile_picture: 'https://th.bing.com/th/id/OIP.S171c9HYsokHyCPs9brbPwHaGP?rs=1&pid=ImgDetMain',
            },
        }));

        res.status(200).json({ posts: sanitized, nextCursor: hasMore ? result[result.length - 1]._id : null, hasMore });
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
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

        // 5. Ranking & Randomization
        let ranked = filteredCandidates;
        try {
            const { UserInterest, PostVector } = require("../models/Recommendation");
            const interest = viewerIdStr ? await UserInterest.findOne({ userId: viewerIdStr }).lean() : null;
            const postVecs = await PostVector.find({ postId: { $in: filteredCandidates.map(c => c._id) } }).lean();
            const vecMap = new Map(postVecs.map(v => [v.postId.toString(), v.vector]));

            const userVec = interest?.interestVector;
            const userMag = userVec ? Math.sqrt(userVec.reduce((sum, val) => sum + val * val, 0)) : 0;

            ranked = filteredCandidates.map(post => {
                let similarity = 0;
                const postVec = vecMap.get(post._id.toString());
                if (postVec && userMag) {
                    const dotProduct = userVec.reduce((sum, val, i) => sum + val * (postVec[i] || 0), 0);
                    const postMag = Math.sqrt(postVec.reduce((sum, val) => sum + val * val, 0));
                    similarity = postMag ? dotProduct / (userMag * postMag) : 0;
                }

                const hoursOld = (Date.now() - new Date(post.createdAt)) / (1000 * 60 * 60);
                const recency = Math.exp(-hoursOld / 48); // 2-day half-life
                const popularity = Math.min(1, (post.likes?.length || 0) / 100);

                // Final Score = Similarity + Recency + Popularity + Random Jitter
                const jitter = Math.random() * 0.15;
                const finalScore = (0.4 * similarity) + (0.3 * recency) + (0.2 * popularity) + jitter;

                return { ...post, _score: finalScore };
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

        const finalPosts = resultWithPresence.map(p => sanitizePost(p, viewerId));
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