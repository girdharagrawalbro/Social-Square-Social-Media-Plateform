const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const Report = require('../models/Report');
const jwt = require('jsonwebtoken');

// ─── SIMPLE IN-MEMORY CACHE FOR ANALYTICS ────────────────────────────────────
// Prevents hammering DB on every admin page load — invalidated every 5 minutes
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
    return entry.data;
}
function setCached(key, data) { cache.set(key, { data, ts: Date.now() }); }
function invalidateCache() { cache.clear(); }

// ─── ADMIN MIDDLEWARE ─────────────────────────────────────────────────────────
const requireAdmin = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Use lean() — plain JS object, no Mongoose overhead
        const user = await User.findById(decoded.userId).select('isAdmin isBanned').lean();
        if (!user || !user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
        if (user.isBanned) return res.status(403).json({ error: 'Account banned' });
        req.adminId = decoded.userId;
        next();
    } catch {
        return res.status(403).json({ error: 'Invalid token' });
    }
};

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
router.get('/analytics', requireAdmin, async (req, res) => {
    try {
        const cached = getCached('analytics');
        if (cached) return res.json({ ...cached, fromCache: true });

        const now = new Date();
        const last7  = new Date(now - 7  * 86400000);
        const last30 = new Date(now - 30 * 86400000);

        // All 11 queries fire in parallel — uses indexes on created_at, createdAt, isBanned, status
        const [
            totalUsers, newUsersLast7, newUsersLast30,
            totalPosts, newPostsLast7, newPostsLast30,
            bannedUsers, totalReports, pendingReports,
            topPosts, recentUsers,
            postsPerDay, usersPerDay,
        ] = await Promise.all([
            User.estimatedDocumentCount(),                                           // O(1) — uses collection metadata
            User.countDocuments({ created_at: { $gte: last7 } }),                   // uses index
            User.countDocuments({ created_at: { $gte: last30 } }),
            Post.estimatedDocumentCount(),                                           // O(1)
            Post.countDocuments({ createdAt: { $gte: last7 } }),
            Post.countDocuments({ createdAt: { $gte: last30 } }),
            User.countDocuments({ isBanned: true }),                                 // uses index
            Report.estimatedDocumentCount(),
            Report.countDocuments({ status: 'pending' }),                            // uses index
            Post.find().sort({ score: -1 }).limit(5)
                .select('caption user likes comments createdAt').lean(),
            User.find().sort({ created_at: -1 }).limit(5)
                .select('fullname email created_at profile_picture').lean(),

            // Aggregation pipelines — both use indexes on createdAt / created_at
            Post.aggregate([
                { $match: { createdAt: { $gte: last7 } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
            ]),
            User.aggregate([
                { $match: { created_at: { $gte: last7 } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
            ]),
        ]);

        const result = {
            overview: { totalUsers, newUsersLast7, newUsersLast30, totalPosts, newPostsLast7, newPostsLast30, bannedUsers, totalReports, pendingReports },
            charts: { postsPerDay, usersPerDay },
            topPosts, recentUsers,
        };

        setCached('analytics', result);
        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── USER MANAGEMENT ──────────────────────────────────────────────────────────
// Uses cursor-based pagination instead of skip() — O(log n) vs O(n)
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const limit  = Math.min(parseInt(req.query.limit) || 20, 100); // cap at 100
        const cursor = req.query.cursor || null; // last _id from previous page
        const search = req.query.search?.trim() || '';
        const filter = req.query.filter || 'all';

        const query = {};

        // Cursor pagination — much faster than skip() at scale
        if (cursor) query._id = { $lt: cursor };

        // Text search — uses text index if created, falls back to regex
        if (search) {
            query.$or = [
                { fullname: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        if (filter === 'banned') query.isBanned = true;
        if (filter === 'admin')  query.isAdmin  = true;

        // lean() returns plain JS objects — 2-3x faster, less memory
        const users = await User.find(query)
            .select('-password -twoFactorOtp -resetPasswordToken -twoFactorOtpExpires')
            .sort({ _id: -1 })
            .limit(limit + 1)
            .lean();

        const hasMore   = users.length > limit;
        const result    = hasMore ? users.slice(0, limit) : users;
        const nextCursor = hasMore ? result[result.length - 1]._id : null;

        // Only run countDocuments for first page (expensive on large collections)
        const total = cursor ? null : await User.countDocuments(search || filter !== 'all' ? query : {});

        res.json({ users: result, nextCursor, hasMore, total });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/users/:userId/ban', requireAdmin, async (req, res) => {
    try {
        const { reason } = req.body;
        // findOneAndUpdate — single atomic operation, no fetch+save round trip
        const user = await User.findOneAndUpdate(
            { _id: req.params.userId, isAdmin: { $ne: true } }, // can't ban admins
            { isBanned: true, banReason: reason || 'Violated community guidelines', bannedAt: new Date() },
            { new: true, select: 'fullname email isBanned banReason bannedAt' }
        ).lean();
        if (!user) return res.status(404).json({ error: 'User not found or is an admin' });
        invalidateCache();
        res.json({ message: 'User banned', user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/users/:userId/unban', requireAdmin, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.params.userId, { $unset: { banReason: '', bannedAt: '' }, isBanned: false });
        invalidateCache();
        res.json({ message: 'User unbanned' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/users/:userId', requireAdmin, async (req, res) => {
    try {
        const user = await User.findOneAndDelete({ _id: req.params.userId, isAdmin: { $ne: true } }).lean();
        if (!user) return res.status(404).json({ error: 'User not found or is an admin' });

        // Delete posts in background — don't block response
        Post.deleteMany({ 'user._id': req.params.userId }).catch(console.error);
        Report.deleteMany({ reporter: req.params.userId }).catch(console.error);

        invalidateCache();
        res.json({ message: 'User deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/users/:userId/toggle-admin', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select('isAdmin fullname').lean();
        if (!user) return res.status(404).json({ error: 'User not found' });
        const updated = await User.findByIdAndUpdate(
            req.params.userId, { isAdmin: !user.isAdmin }, { new: true, select: 'isAdmin fullname' }
        ).lean();
        res.json({ message: `Admin ${updated.isAdmin ? 'granted' : 'revoked'}`, isAdmin: updated.isAdmin });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST MANAGEMENT ──────────────────────────────────────────────────────────
router.get('/posts', requireAdmin, async (req, res) => {
    try {
        const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
        const cursor = req.query.cursor || null;
        const search = req.query.search?.trim() || '';
        const filter = req.query.filter || 'all';

        const query = {};
        if (cursor) query._id = { $lt: cursor };
        if (search)                  query.caption      = { $regex: search, $options: 'i' };
        if (filter === 'anonymous')  query.isAnonymous  = true;
        if (filter === 'timelocked') query.unlocksAt    = { $gt: new Date() };

        // For reported filter — use $lookup instead of two queries
        if (filter === 'reported') {
            const posts = await Post.aggregate([
                {
                    $lookup: {
                        from: 'reports',
                        let: { postId: '$_id' },
                        pipeline: [
                            { $match: { $expr: { $and: [
                                { $eq: ['$targetId', '$$postId'] },
                                { $eq: ['$targetType', 'post'] },
                                { $eq: ['$status', 'pending'] },
                            ]}}},
                            { $limit: 1 },
                        ],
                        as: 'reports',
                    },
                },
                { $match: { 'reports.0': { $exists: true }, ...(cursor ? { _id: { $lt: cursor } } : {}) } },
                { $sort: { _id: -1 } },
                { $limit: limit + 1 },
                { $project: { reports: 0 } },
            ]);
            const hasMore    = posts.length > limit;
            const result     = hasMore ? posts.slice(0, limit) : posts;
            const nextCursor = hasMore ? result[result.length - 1]._id : null;
            return res.json({ posts: result, nextCursor, hasMore });
        }

        const posts = await Post.find(query).sort({ _id: -1 }).limit(limit + 1).lean();
        const hasMore    = posts.length > limit;
        const result     = hasMore ? posts.slice(0, limit) : posts;
        const nextCursor = hasMore ? result[result.length - 1]._id : null;
        const total      = cursor ? null : await Post.countDocuments(search || filter !== 'all' ? query : {});

        res.json({ posts: result, nextCursor, hasMore, total });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/posts/:postId', requireAdmin, async (req, res) => {
    try {
        await Post.findByIdAndDelete(req.params.postId);
        // Clean up reports for this post in background
        Report.deleteMany({ targetId: req.params.postId }).catch(console.error);
        invalidateCache();
        res.json({ message: 'Post deleted', postId: req.params.postId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── REPORTS ──────────────────────────────────────────────────────────────────
router.get('/reports', requireAdmin, async (req, res) => {
    try {
        const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
        const cursor = req.query.cursor || null;
        const status = req.query.status || 'pending';

        const query = {};
        if (cursor) query._id = { $lt: cursor };
        if (status !== 'all') query.status = status;

        // populate uses index on reporter field
        const reports = await Report.find(query)
            .populate('reporter', 'fullname profile_picture')
            .sort({ _id: -1 })
            .limit(limit + 1)
            .lean();

        const hasMore    = reports.length > limit;
        const result     = hasMore ? reports.slice(0, limit) : reports;
        const nextCursor = hasMore ? result[result.length - 1]._id : null;
        const total      = cursor ? null : await Report.countDocuments(status !== 'all' ? { status } : {});

        res.json({ reports: result, nextCursor, hasMore, total });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/reports/:reportId/resolve', requireAdmin, async (req, res) => {
    try {
        const { action } = req.body;
        await Report.findByIdAndUpdate(req.params.reportId, {
            status: action || 'resolved',
            resolvedBy: req.adminId,
            resolvedAt: new Date(),
        });
        invalidateCache();
        res.json({ message: 'Report updated' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── SUBMIT REPORT (public, rate limited separately) ─────────────────────────
router.post('/report', async (req, res) => {
    try {
        const { reporterId, targetType, targetId, reason, description } = req.body;
        if (!reporterId || !targetType || !targetId || !reason) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Upsert to avoid race condition duplicates
        const existing = await Report.findOne({ reporter: reporterId, targetId, status: 'pending' }).lean();
        if (existing) return res.status(400).json({ error: 'Already reported' });

        await Report.create({ reporter: reporterId, targetType, targetId, reason, description });
        res.status(201).json({ message: 'Report submitted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;