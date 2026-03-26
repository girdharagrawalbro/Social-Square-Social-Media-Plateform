const express = require('express');
const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Category = require("../models/Category");
const { publish } = require('../lib/pubsub');
const verifyToken = require('../middleware/Verifytoken');

const router = express.Router();


// io is injected from index.js
let _io;
function setIo(io) { _io = io; }

function computeScore(post, followingIds = []) {
    const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
    return (post.likes?.length || 0) * 2 + (post.comments?.length || 0) * 3
        + (followingIds.includes(post.user._id.toString()) ? 20 : 0)
        + Math.max(0, 50 - ageHours * 0.5);
}

// ─── CREATE (PROTECTED) ────────────────────────────────────────────────────────
router.post("/create", verifyToken, async (req, res) => {
    try {
        const {
            caption, category, imageURLs, location, music,
            isAnonymous, expiresAt, unlocksAt, isCollaborative,
            collaboratorIds, voiceNoteUrl, voiceNoteDuration, mood,
            isAiGenerated,
        } = req.body;
        const loggedUserId = req.userId; // Secure: from token

        if (!caption || !loggedUserId || !category) return res.status(400).json({ message: "All fields are required." });

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
            user: isAnonymous
                ? { _id: userDetails._id, fullname: 'Anonymous', profile_picture: 'https://ui-avatars.com/api/?name=A&background=808bf5&color=fff' }
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
        });
        await newPost.save();


        if (_io && collaborators.length > 0) {
            collaborators.forEach(c => {
                _io.to(c.userId.toString()).emit('collaborationInvite', { postId: newPost._id, postCaption: caption, invitedBy: userDetails.fullname });
            });
        }

        // Anonymous posts do NOT go to followers' feeds
        if (!isAnonymous && !unlocksAt && _io && userDetails.followers?.length > 0) {
            userDetails.followers.forEach(followerId => {
                _io.to(followerId.toString()).emit('newFeedPost', newPost);
            });
        }

        if (isAnonymous && _io) {
            _io.emit('newConfessionPost', newPost);
        }

        if (!isAnonymous) {
            publish('posts.created', { id: newPost._id, user: newPost.user, category: newPost.category })
                .catch(err => console.warn('[NATS]:', err.message));
        }

        res.status(201).json(newPost);
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
router.get("/collaborate/invites/:userId", async (req, res) => {
    try {
        const posts = await Post.find({
            collaborators: {
                $elemMatch: {
                    userId: req.params.userId,
                    status: 'pending'
                }
            }
        });
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
        let followingIds = [], userCategories = [];
        if (userId) {
            const user = await User.findById(userId).select('following');
            if (user) followingIds = user.following.map(id => id.toString());
            const likedPosts = await Post.find({ likes: userId }).select('category').limit(20);
            userCategories = [...new Set(likedPosts.map(p => p.category))];
        }
        // Exclude anonymous posts from normal feed — they appear in confessions feed only
        // Also exclude time-locked posts that haven't unlocked yet
        const query = {
            isAnonymous: { $ne: true },
            $or: [{ unlocksAt: null }, { unlocksAt: { $lte: new Date() } }],
            ...(cursor ? { _id: { $lt: cursor } } : {}),
        };
        const posts = await Post.find(query).sort({ _id: -1 }).limit(limit * 3);
        const scored = posts.map(post => {
            let score = computeScore(post, followingIds);
            if (userCategories.includes(post.category)) score += 15;
            return { post, score };
        }).sort((a, b) => b.score - a.score);
        const result = scored.slice(0, limit).map(s => s.post);
        const hasMore = posts.length >= limit;
        const nextCursor = result.length > 0 ? result[result.length - 1]._id : null;
        res.status(200).json({ posts: result, nextCursor, hasMore });
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── USER POSTS ───────────────────────────────────────────────────────────────
router.get("/user/:userId", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 12;
        const cursor = req.query.cursor;
        // Show all posts for profile page — owner sees their own anonymous posts too
        const query = { 'user._id': req.params.userId, ...(cursor ? { _id: { $lt: cursor } } : {}) };
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
            return res.status(200).json({ saved: true });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/saved/:userId", async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select('savedPosts');
        if (!user) return res.status(404).json({ message: 'User not found.' });
        const posts = await Post.find({ _id: { $in: user.savedPosts } }).sort({ createdAt: -1 });
        res.status(200).json(posts);
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── TRENDING ─────────────────────────────────────────────────────────────────
router.get("/trending", async (req, res) => {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const trending = await Post.aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo } } },
            { $group: { _id: '$category', postCount: { $sum: 1 }, totalLikes: { $sum: { $size: '$likes' } }, totalComments: { $sum: { $size: '$comments' } } } },
            { $addFields: { score: { $add: ['$totalLikes', { $multiply: ['$totalComments', 2] }, '$postCount'] } } },
            { $sort: { score: -1 } }, { $limit: 10 },
            { $project: { category: '$_id', postCount: 1, totalLikes: 1, totalComments: 1, score: 1, _id: 0 } }
        ]);
        res.status(200).json(trending);
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
        if (!post.likes.includes(userId)) {
            post.likes.push(userId);
            post.score = computeScore(post);
            await post.save();

            // ✅ Broadcast like update to all connected users
            if (_io) _io.emit('postLiked', { postId, userId, likesCount: post.likes.length });

            res.status(200).json({ message: "Success" });
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
        if (post.likes.includes(userId)) {
            post.likes = post.likes.filter(id => id.toString() !== userId);
            post.score = computeScore(post);
            await post.save();

            // ✅ Broadcast unlike update to all connected users
            if (_io) _io.emit('postUnliked', { postId, userId, likesCount: post.likes.length });

            res.status(200).json({ message: "success" });
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

// ─── FETCH COMMENTS ───────────────────────────────────────────────────────────
router.get('/comments', async (req, res) => {
    try {
        const { postId } = req.query;
        if (!postId) return res.status(400).json({ error: 'postId required as query param' });
        const comments = await Comment.find({ postId, parentId: null }).sort({ createdAt: 1 });
        const withReplies = await Promise.all(comments.map(async (comment) => {
            const replies = await Comment.find({ parentId: comment._id }).sort({ createdAt: 1 });
            return { ...comment.toObject(), repliesList: replies };
        }));
        res.status(200).json(withReplies);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── ADD COMMENT ──────────────────────────────────────────────────────────────
router.post('/comments/add', async (req, res) => {
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

        return res.status(200).json(newComment);
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
        const liked = comment.likes.includes(userId);
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
                profile_picture: 'https://ui-avatars.com/api/?name=A&background=808bf5&color=fff',
            },
        }));

        res.status(200).json({ posts: sanitized, nextCursor: hasMore ? result[result.length - 1]._id : null, hasMore });
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

module.exports = router;
module.exports.setIo = setIo;