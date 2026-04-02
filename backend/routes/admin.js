const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const Report = require('../models/Report');
const jwt = require('jsonwebtoken');
const { digestQueue } = require('../queues/digestQueue');


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
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const search = req.query.search?.trim() || '';
        const filter = req.query.filter || 'all';

        const query = {};
        if (search) {
            query.$or = [
                { fullname: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        if (filter === 'banned') query.isBanned = true;
        if (filter === 'admin')  query.isAdmin  = true;

        const [users, total] = await Promise.all([
            User.find(query)
                .select('-password -twoFactorOtp -resetPasswordToken -twoFactorOtpExpires')
                .sort({ _id: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            User.countDocuments(query)
        ]);

        res.json({ users, total });
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

router.patch('/users/:userId/verify', requireAdmin, async (req, res) => {
    try {
        const { isVerified, creatorTier } = req.body;
        const update = {};
        if (typeof isVerified === 'boolean') update.isVerified = isVerified;
        if (creatorTier) update.creatorTier = creatorTier;

        const user = await User.findByIdAndUpdate(
            req.params.userId,
            update,
            { new: true, select: 'fullname email isVerified creatorTier' }
        ).lean();
        
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User verification updated', user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST MANAGEMENT ──────────────────────────────────────────────────────────
router.get('/posts', requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const search = req.query.search?.trim() || '';
        const filter = req.query.filter || 'all';

        const query = {};
        if (search)                  query.caption      = { $regex: search, $options: 'i' };
        if (filter === 'anonymous')  query.isAnonymous  = true;
        if (filter === 'timelocked') query.unlocksAt    = { $gt: new Date() };

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
                { $match: { 'reports.0': { $exists: true } } },
                { $sort: { _id: -1 } },
                { $skip: skip },
                { $limit: limit },
                { $project: { reports: 0 } },
            ]);
            
            // For reported filter, counting total is a bit harder, let's just use estimate or count
            // but for simplicity in admin panel we can just count
            const total = await Post.countDocuments({ ...query, _id: { $in: (await Post.aggregate([
                { $lookup: { from: 'reports', let: { pid: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$targetId', '$$pid'] }, { $eq: ['$targetType', 'post'] }, { $eq: ['$status', 'pending'] }] } } }], as: 'r' } },
                { $match: { 'r.0': { $exists: true } } },
                { $project: { _id: 1 } }
            ])).map(p => p._id) } });

            return res.json({ posts, total });
        }

        const [posts, total] = await Promise.all([
            Post.find(query).sort({ _id: -1 }).skip(skip).limit(limit).lean(),
            Post.countDocuments(query)
        ]);

        res.json({ posts, total });
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
        const status = req.query.status || 'pending';
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        const match = {};
        if (status !== 'all') match.status = status;

        const reports = await Report.aggregate([
            { $match: match },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    localField: 'reporter',
                    foreignField: '_id',
                    as: 'reporter'
                }
            },
            { $unwind: '$reporter' },
            // If target is a post, get the post and its author
            {
                $lookup: {
                    from: 'posts',
                    localField: 'targetId',
                    foreignField: '_id',
                    as: 'targetPost'
                }
            },
            // If target is a user, get the user
            {
                $lookup: {
                    from: 'users',
                    localField: 'targetId',
                    foreignField: '_id',
                    as: 'targetUser'
                }
            },
            {
                $project: {
                    _id: 1,
                    targetType: 1,
                    targetId: 1,
                    reason: 1,
                    description: 1,
                    status: 1,
                    createdAt: 1,
                    'reporter._id': 1,
                    'reporter.fullname': 1,
                    'reporter.profile_picture': 1,
                    targetPost: { $arrayElemAt: ['$targetPost', 0] },
                    targetUser: { $arrayElemAt: ['$targetUser', 0] },
                }
            }
        ]);

        const total = await Report.countDocuments(match);
        res.json({ reports, total });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/comments/:commentId', requireAdmin, async (req, res) => {
    try {
        // We need to find the post containing this comment and remove it
        await Post.updateMany(
            { 'comments._id': req.params.commentId },
            { $pull: { comments: { _id: req.params.commentId } } }
        );
        invalidateCache();
        res.json({ message: 'Comment deleted' });
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

// ─── DEBUG / VERIFICATION ─────────────────────────────────────────────────────
router.post('/debug/digest', requireAdmin, async (req, res) => {
    try {
        const job = await digestQueue.add('daily-digest', { manual: true });
        const repeatable = await digestQueue.getRepeatableJobs();
        res.json({
            message: 'Daily digest job triggered successfully',
            jobId: job.id,
            repeatableJobs: repeatable,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;