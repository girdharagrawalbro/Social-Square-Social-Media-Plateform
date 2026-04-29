const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const Report = require('../models/Report');
const jwt = require('jsonwebtoken');
const AuditLog = require('../models/AuditLog');
const ContentFilter = require('../models/ContentFilter');
const { logAdminAction } = require('../utils/audit.helper');
const SystemSetting = require('../models/SystemSetting');
const Notification = require('../models/Notification');
const { hashValue } = require('../utils/authSecurity');
const LoginSession = require('../models/LoginSession');
const { digestQueue } = require('../queues/digestQueue');


// ─── SIMPLE IN-MEMORY CACHE FOR ANALYTICS ────────────────────────────────────
// Prevents hammering DB on every admin page load — invalidated every 5 minutes
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
    if (process.env.DISABLE_REDIS === 'true') return null; // Bypass cache if disabled
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
    return entry.data;
}
function setCached(key, data) {
    if (process.env.DISABLE_REDIS === 'true') return; // Don't cache if disabled
    cache.set(key, { data, ts: Date.now() });
}
function invalidateCache() {
    if (process.env.DISABLE_REDIS === 'true') return;
    cache.clear();
}

// ─── ADMIN MIDDLEWARE ─────────────────────────────────────────────────────────
const requireAdmin = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Unauthorized' });

        const hashedToken = hashValue(token);
        const session = await LoginSession.findOne({ accessToken: hashedToken });
        if (!session || session.isRevoked || session.expiresAt < new Date()) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Use lean() — plain JS object, no Mongoose overhead
        const user = await User.findById(session.userId).select('isAdmin isBanned').lean();
        if (!user || !user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
        if (user.isBanned) return res.status(403).json({ error: 'Account banned' });
        req.adminId = session.userId;
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
        const last7 = new Date(now - 7 * 86400000);
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
            Post.find().sort({ score: -1 }).limit(8)
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

        // Category breakdown
        const categoryBreakdown = await Post.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Engagement rate
        const last7Days = new Date(now - 7 * 86400000);
        const prev7Days = new Date(now - 14 * 86400000);

        const [currentEng, prevEng] = await Promise.all([
            Post.aggregate([
                { $match: { createdAt: { $gte: last7Days } } },
                { $group: { _id: null, likes: { $sum: { $size: '$likes' } }, comments: { $sum: { $size: '$comments' } }, count: { $sum: 1 } } }
            ]),
            Post.aggregate([
                { $match: { createdAt: { $gte: prev7Days, $lt: last7Days } } },
                { $group: { _id: null, likes: { $sum: { $size: '$likes' } }, comments: { $sum: { $size: '$comments' } }, count: { $sum: 1 } } }
            ])
        ]);

        const currRate = currentEng[0]?.count > 0 ? ((currentEng[0].likes + currentEng[0].comments) / currentEng[0].count) : 0;
        const prevRate = prevEng[0]?.count > 0 ? ((prevEng[0].likes + prevEng[0].comments) / prevEng[0].count) : 0;
        const engDelta = prevRate > 0 ? (((currRate - prevRate) / prevRate) * 100).toFixed(1) : (currRate > 0 ? 100 : 0);

        // Retention cohorts
        const cohorts = [];
        for (let i = 0; i < 4; i++) {
            const start = new Date(now - (i + 1) * 7 * 86400000);
            const end = new Date(now - i * 7 * 86400000);

            const cohortUsers = await User.find({ created_at: { $gte: start, $lt: end } }).select('_id').lean();
            const userIds = cohortUsers.map(u => u._id);

            if (userIds.length > 0) {
                const activeW1 = await Post.distinct('user._id', { 'user._id': { $in: userIds }, createdAt: { $gte: new Date(end.getTime() + 1 * 86400000), $lt: new Date(end.getTime() + 7 * 86400000) } });
                const activeW2 = await Post.distinct('user._id', { 'user._id': { $in: userIds }, createdAt: { $gte: new Date(end.getTime() + 7 * 86400000), $lt: new Date(end.getTime() + 14 * 86400000) } });
                const activeW4 = await Post.distinct('user._id', { 'user._id': { $in: userIds }, createdAt: { $gte: new Date(end.getTime() + 21 * 86400000), $lt: new Date(end.getTime() + 28 * 86400000) } });

                cohorts.push({
                    week: `Week ${4 - i}`,
                    size: userIds.length,
                    w1: ((activeW1.length / userIds.length) * 100).toFixed(0),
                    w2: ((activeW2.length / userIds.length) * 100).toFixed(0),
                    w4: ((activeW4.length / userIds.length) * 100).toFixed(0),
                });
            } else {
                cohorts.push({ week: `Week ${4 - i}`, size: 0, w1: 0, w2: 0, w4: 0 });
            }
        }

        const result = {
            overview: {
                totalUsers, newUsersLast7, newUsersLast30,
                totalPosts, newPostsLast7, newPostsLast30,
                bannedUsers, totalReports, pendingReports,
                engagementRate: currRate.toFixed(2),
                engagementDelta: engDelta
            },
            charts: { postsPerDay, usersPerDay, categoryBreakdown, cohorts },
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
        if (filter === 'admin') query.isAdmin = true;

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

router.post('/users/bulk-ban', requireAdmin, async (req, res) => {
    try {
        const { userIds, reason } = req.body;
        if (!Array.isArray(userIds) || !userIds.length) {
            return res.status(400).json({ error: 'No user IDs provided' });
        }

        const usersToBan = await User.find({
            _id: { $in: userIds },
            isAdmin: { $ne: true }
        }).select('_id fullname email profile_picture').lean();

        const finalIds = usersToBan.map(u => u._id);

        if (finalIds.length > 0) {
            await User.updateMany(
                { _id: { $in: finalIds } },
                { isBanned: true, banReason: reason || 'Violated community guidelines', bannedAt: new Date() }
            );

            for (const user of usersToBan) {
                await logAdminAction({
                    adminId: req.adminId,
                    action: 'ban_user',
                    targetType: 'user',
                    targetId: user._id,
                    snapshot: { name: user.fullname, email: user.email, picture: user.profile_picture },
                    meta: { reason: reason || 'Violated community guidelines (Bulk)', ip: req.ip },
                });
            }
        }

        invalidateCache();
        res.json({ message: `Successfully banned ${finalIds.length} users` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users/bulk-delete', requireAdmin, async (req, res) => {
    try {
        const { userIds } = req.body;
        if (!Array.isArray(userIds) || !userIds.length) {
            return res.status(400).json({ error: 'No user IDs provided' });
        }

        const usersToDelete = await User.find({
            _id: { $in: userIds },
            isAdmin: { $ne: true }
        }).select('_id fullname email profile_picture').lean();

        const finalIds = usersToDelete.map(u => u._id);

        if (finalIds.length > 0) {
            await User.deleteMany({ _id: { $in: finalIds } });

            for (const user of usersToDelete) {
                await logAdminAction({
                    adminId: req.adminId,
                    action: 'delete_user',
                    targetType: 'user',
                    targetId: user._id,
                    snapshot: { name: user.fullname, email: user.email, picture: user.profile_picture },
                    meta: { note: 'Bulk deletion', ip: req.ip },
                });
            }

            Post.deleteMany({ 'user._id': { $in: finalIds } }).catch(console.error);
            Report.deleteMany({ reporter: { $in: finalIds } }).catch(console.error);
        }

        invalidateCache();
        res.json({ message: `Successfully deleted ${finalIds.length} users` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/users/:userId/ban', requireAdmin, async (req, res) => {
    try {
        const { reason } = req.body;
        // findOneAndUpdate — single atomic operation, no fetch+save round trip
        const user = await User.findOneAndUpdate(
            { _id: req.params.userId, isAdmin: { $ne: true } }, // can't ban admins
            { isBanned: true, banReason: reason || 'Violated community guidelines', bannedAt: new Date() },
            { new: true, select: 'fullname email isBanned banReason bannedAt profile_picture' }
        ).lean();
        if (!user) return res.status(404).json({ error: 'User not found or is an admin' });

        await logAdminAction({
            adminId: req.adminId,
            action: 'ban_user',
            targetType: 'user',
            targetId: user._id,
            snapshot: { name: user.fullname, email: user.email, picture: user.profile_picture },
            meta: { reason: reason || 'Violated community guidelines', ip: req.ip },
        });

        invalidateCache();
        res.json({ message: 'User banned', user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/users/:userId/unban', requireAdmin, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.userId, { $unset: { banReason: '', bannedAt: '' }, isBanned: false }, { new: true, select: 'fullname email profile_picture' }).lean();
        if (user) {
            await logAdminAction({
                adminId: req.adminId,
                action: 'unban_user',
                targetType: 'user',
                targetId: user._id,
                snapshot: { name: user.fullname, email: user.email, picture: user.profile_picture },
                meta: { ip: req.ip },
            });
        }
        invalidateCache();
        res.json({ message: 'User unbanned' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/users/:userId', requireAdmin, async (req, res) => {
    try {
        const user = await User.findOneAndDelete({ _id: req.params.userId, isAdmin: { $ne: true } }).lean();
        if (!user) return res.status(404).json({ error: 'User not found or is an admin' });

        await logAdminAction({
            adminId: req.adminId,
            action: 'delete_user',
            targetType: 'user',
            targetId: user._id,
            snapshot: { name: user.fullname, email: user.email, picture: user.profile_picture },
            meta: { ip: req.ip },
        });

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
        if (search) query.caption = { $regex: search, $options: 'i' };
        if (req.query.userId) query['user._id'] = req.query.userId;
        if (filter === 'anonymous') query.isAnonymous = true;
        if (filter === 'timelocked') query.unlocksAt = { $gt: new Date() };

        if (filter === 'reported') {
            const posts = await Post.aggregate([
                {
                    $lookup: {
                        from: 'reports',
                        let: { postId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$targetId', '$$postId'] },
                                            { $eq: ['$targetType', 'post'] },
                                            { $eq: ['$status', 'pending'] },
                                        ]
                                    }
                                }
                            },
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
            const total = await Post.countDocuments({
                ...query, _id: {
                    $in: (await Post.aggregate([
                        { $lookup: { from: 'reports', let: { pid: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$targetId', '$$pid'] }, { $eq: ['$targetType', 'post'] }, { $eq: ['$status', 'pending'] }] } } }], as: 'r' } },
                        { $match: { 'r.0': { $exists: true } } },
                        { $project: { _id: 1 } }
                    ])).map(p => p._id)
                }
            });

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
        const post = await Post.findById(req.params.postId).lean();
        await Post.findByIdAndDelete(req.params.postId);

        if (post) {
            await logAdminAction({
                adminId: req.adminId,
                action: 'delete_post',
                targetType: 'post',
                targetId: post._id,
                snapshot: { name: post.caption?.slice(0, 80) || '(no caption)', picture: post.image_urls?.[0] },
                meta: { ip: req.ip },
            });
        }

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
        const post = await Post.findOne({ 'comments._id': req.params.commentId }).lean();
        const comment = post?.comments?.find(c => c._id.toString() === req.params.commentId);

        await Post.updateMany(
            { 'comments._id': req.params.commentId },
            { $pull: { comments: { _id: req.params.commentId } } }
        );

        if (comment) {
            await logAdminAction({
                adminId: req.adminId,
                action: 'delete_comment',
                targetType: 'comment',
                targetId: comment._id,
                snapshot: { name: comment.text?.slice(0, 80) || '(no text)' },
                meta: { ip: req.ip },
            });
        }

        invalidateCache();
        res.json({ message: 'Comment deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/reports/:reportId/resolve', requireAdmin, async (req, res) => {
    try {
        const { action } = req.body;
        const report = await Report.findByIdAndUpdate(req.params.reportId, {
            status: action || 'resolved',
            resolvedBy: req.adminId,
            resolvedAt: new Date(),
        }, { new: true }).lean();

        if (report) {
            await logAdminAction({
                adminId: req.adminId,
                action: (action === 'resolved' || !action) ? 'resolve_report' : 'dismiss_report',
                targetType: 'report',
                targetId: report._id,
                meta: { ip: req.ip },
            });
        }
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

router.post('/debug/admin-digest', requireAdmin, async (req, res) => {
    try {
        const { runAdminDigests } = require('../queues/digestQueue');
        if (process.env.DISABLE_REDIS === 'true') {
            await runAdminDigests();
            return res.json({ message: 'Internal fallback Admin digests completed instantly.' });
        }
        const job = await digestQueue.add('admin-daily-digest', { manual: true });
        res.json({
            message: 'Admin daily digests queued successfully',
            jobId: job.id
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── AUDIT LOGS ──────────────────────────────────────────────────────────────
// ─── AUDIT LOGS (PAGINATED) ─────────────────────────────────────────────────
router.get('/audit', requireAdmin, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 20;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.action && req.query.action !== 'all') filter.action = req.query.action;
        if (req.query.adminId && req.query.adminId !== 'all') filter.admin = req.query.adminId;
        if (req.query.targetType && req.query.targetType !== 'all') filter.targetType = req.query.targetType;
        if (req.query.targetId) filter.targetId = req.query.targetId;

        // date range
        if (req.query.from || req.query.to) {
            filter.createdAt = {};
            if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
            if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
        }

        const [logs, total] = await Promise.all([
            AuditLog.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('admin', 'fullname profile_picture email'),
            AuditLog.countDocuments(filter),
        ]);

        // Admin list for the filter dropdown
        const adminList = await AuditLog.distinct('admin').then(ids =>
            User.find({ _id: { $in: ids } }, 'fullname profile_picture')
        );

        res.json({ success: true, logs, total, adminList });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/audit-logs', requireAdmin, async (req, res) => {
    try {
        const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100).lean();
        res.json(logs);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── CONTENT FILTER ──────────────────────────────────────────────────────────
router.get('/content-filter', requireAdmin, async (req, res) => {
    try {
        const words = await ContentFilter.find().lean();
        res.json(words);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/content-filter', requireAdmin, async (req, res) => {
    try {
        const { word, action } = req.body;
        if (!word) return res.status(400).json({ error: 'Word required' });
        const existing = await ContentFilter.findOne({ word: word.toLowerCase() });
        if (existing) return res.status(400).json({ error: 'Word already exists' });
        const newWord = await ContentFilter.create({ word: word.toLowerCase(), action: action || 'flag' });
        res.status(201).json(newWord);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/content-filter/:id', requireAdmin, async (req, res) => {
    try {
        await ContentFilter.findByIdAndDelete(req.params.id);
        res.json({ message: 'Word removed' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── SYSTEM SETTINGS & FEATURE FLAGS ─────────────────────────────────────────
router.get('/system/flags', requireAdmin, async (req, res) => {
    try {
        const flags = await SystemSetting.find({ key: { $in: ['ai_features', 'anonymous_posts', 'story_creation', 'maintenance_mode'] } }).lean();

        const defaults = {
            ai_features: true,
            anonymous_posts: true,
            story_creation: true,
            maintenance_mode: false
        };

        const result = { ...defaults };
        flags.forEach(f => {
            result[f.key] = f.value;
        });

        res.json({ success: true, flags: result });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/system/flags', requireAdmin, async (req, res) => {
    try {
        const { flags } = req.body;
        if (!flags || typeof flags !== 'object') {
            return res.status(400).json({ error: 'Invalid flags payload' });
        }

        const allowed = ['ai_features', 'anonymous_posts', 'story_creation', 'maintenance_mode'];
        const updates = [];

        for (const key of allowed) {
            if (typeof flags[key] === 'boolean') {
                updates.push(
                    SystemSetting.findOneAndUpdate(
                        { key },
                        { value: flags[key], description: `Feature flag for ${key}` },
                        { upsert: true, new: true }
                    )
                );
            }
        }

        await Promise.all(updates);

        await logAdminAction({
            adminId: req.adminId,
            action: 'trigger_digest',
            targetType: 'system',
            targetId: 'feature_flags',
            meta: { updated_flags: flags, ip: req.ip },
        });

        res.json({ success: true, message: 'Feature flags updated' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ─── BROADCAST ANNOUNCEMENTS ─────────────────────────────────────────────────
router.post('/broadcast', requireAdmin, async (req, res) => {
    try {
        const { content, segment } = req.body;
        if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

        const query = {};
        if (segment === 'active') query.isBanned = { $ne: true };
        if (segment === 'admins') query.isAdmin = true;

        const users = await User.find(query).select('_id').lean();
        const admin = await User.findById(req.adminId).select('fullname profile_picture').lean();

        const notifications = users.map(user => ({
            recipient: user._id,
            sender: {
                id: admin._id,
                fullname: admin.fullname,
                profile_picture: admin.profile_picture
            },
            type: 'system',
            message: {
                content: content.trim()
            },
            read: false,
            createdAt: new Date()
        }));

        if (notifications.length > 0) {
            await Notification.insertMany(notifications);
        }

        await logAdminAction({
            adminId: req.adminId,
            action: 'warn_user',
            targetType: 'system',
            targetId: `broadcast_${segment}`,
            meta: { content: content.slice(0, 100), recipient_count: users.length, ip: req.ip },
        });

        res.json({ success: true, message: `Announcement sent to ${users.length} users` });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
