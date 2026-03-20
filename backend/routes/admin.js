const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const Report = require('../models/Report');
const jwt = require('jsonwebtoken');

// ─── ADMIN MIDDLEWARE ─────────────────────────────────────────────────────────
const requireAdmin = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('isAdmin isBanned');
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
        const now = new Date();
        const last7 = new Date(now - 7 * 86400000);
        const last30 = new Date(now - 30 * 86400000);

        const [
            totalUsers, newUsersLast7, newUsersLast30,
            totalPosts, newPostsLast7, newPostsLast30,
            bannedUsers, totalReports, pendingReports,
            topPosts, recentUsers,
        ] = await Promise.all([
            User.countDocuments({ isAdmin: { $ne: true } }),
            User.countDocuments({ created_at: { $gte: last7 } }),
            User.countDocuments({ created_at: { $gte: last30 } }),
            Post.countDocuments(),
            Post.countDocuments({ createdAt: { $gte: last7 } }),
            Post.countDocuments({ createdAt: { $gte: last30 } }),
            User.countDocuments({ isBanned: true }),
            Report.countDocuments(),
            Report.countDocuments({ status: 'pending' }),
            Post.find().sort({ score: -1 }).limit(5).select('caption user likes comments createdAt'),
            User.find().sort({ created_at: -1 }).limit(5).select('fullname email created_at profile_picture'),
        ]);

        // Posts per day last 7 days
        const postsPerDay = await Post.aggregate([
            { $match: { createdAt: { $gte: last7 } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
        ]);

        // Users per day last 7 days
        const usersPerDay = await User.aggregate([
            { $match: { created_at: { $gte: last7 } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
        ]);

        res.json({
            overview: { totalUsers, newUsersLast7, newUsersLast30, totalPosts, newPostsLast7, newPostsLast30, bannedUsers, totalReports, pendingReports },
            charts: { postsPerDay, usersPerDay },
            topPosts, recentUsers,
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── USER MANAGEMENT ──────────────────────────────────────────────────────────

router.get('/users', requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', filter = 'all' } = req.query;
        const query = {};
        if (search) query.$or = [{ fullname: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
        if (filter === 'banned') query.isBanned = true;
        if (filter === 'admin') query.isAdmin = true;

        const [users, total] = await Promise.all([
            User.find(query).select('-password -twoFactorOtp -resetPasswordToken').sort({ created_at: -1 }).skip((page - 1) * limit).limit(parseInt(limit)),
            User.countDocuments(query),
        ]);
        res.json({ users, total, pages: Math.ceil(total / limit), page: parseInt(page) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/users/:userId/ban', requireAdmin, async (req, res) => {
    try {
        const { reason } = req.body;
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.isAdmin) return res.status(403).json({ error: 'Cannot ban an admin' });
        user.isBanned = true;
        user.banReason = reason || 'Violated community guidelines';
        user.bannedAt = new Date();
        await user.save();
        res.json({ message: 'User banned', user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/users/:userId/unban', requireAdmin, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.params.userId, { isBanned: false, banReason: null, bannedAt: null });
        res.json({ message: 'User unbanned' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/users/:userId', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.isAdmin) return res.status(403).json({ error: 'Cannot delete an admin' });
        await User.findByIdAndDelete(req.params.userId);
        await Post.deleteMany({ 'user._id': req.params.userId });
        res.json({ message: 'User and their posts deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/users/:userId/toggle-admin', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        user.isAdmin = !user.isAdmin;
        await user.save();
        res.json({ message: `Admin status ${user.isAdmin ? 'granted' : 'revoked'}`, isAdmin: user.isAdmin });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST MANAGEMENT ──────────────────────────────────────────────────────────

router.get('/posts', requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', filter = 'all' } = req.query;
        const query = {};
        if (search) query.caption = { $regex: search, $options: 'i' };
        if (filter === 'reported') {
            const reportedIds = await Report.distinct('targetId', { targetType: 'post', status: 'pending' });
            query._id = { $in: reportedIds };
        }
        if (filter === 'anonymous') query.isAnonymous = true;
        if (filter === 'timelocked') query.unlocksAt = { $gt: new Date() };

        const [posts, total] = await Promise.all([
            Post.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)),
            Post.countDocuments(query),
        ]);
        res.json({ posts, total, pages: Math.ceil(total / limit), page: parseInt(page) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/posts/:postId', requireAdmin, async (req, res) => {
    try {
        await Post.findByIdAndDelete(req.params.postId);
        res.json({ message: 'Post deleted', postId: req.params.postId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── REPORTS ──────────────────────────────────────────────────────────────────

router.get('/reports', requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, status = 'pending' } = req.query;
        const query = status !== 'all' ? { status } : {};
        const [reports, total] = await Promise.all([
            Report.find(query).populate('reporter', 'fullname profile_picture').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit)),
            Report.countDocuments(query),
        ]);
        res.json({ reports, total, pages: Math.ceil(total / limit) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/reports/:reportId/resolve', requireAdmin, async (req, res) => {
    try {
        const { action } = req.body; // 'resolved' | 'dismissed'
        await Report.findByIdAndUpdate(req.params.reportId, {
            status: action || 'resolved',
            resolvedBy: req.adminId,
            resolvedAt: new Date(),
        });
        res.json({ message: 'Report updated' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── SUBMIT REPORT (public) ───────────────────────────────────────────────────
router.post('/report', async (req, res) => {
    try {
        const { reporterId, targetType, targetId, reason, description } = req.body;
        if (!reporterId || !targetType || !targetId || !reason) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Check duplicate
        const existing = await Report.findOne({ reporter: reporterId, targetId, status: 'pending' });
        if (existing) return res.status(400).json({ error: 'Already reported' });

        const report = new Report({ reporter: reporterId, targetType, targetId, reason, description });
        await report.save();
        res.status(201).json({ message: 'Report submitted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;