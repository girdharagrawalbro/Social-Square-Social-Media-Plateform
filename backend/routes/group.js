const express = require("express");
const router = express.Router();
const Group = require("../models/Group");
const AccountabilityCheckIn = require("../models/AccountabilityCheckIn");
const verifyToken = require("../middleware/Verifytoken");
const { body, param, validationResult } = require('express-validator');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
};

// Helper to get start of week (Monday)
const getStartOfWeek = (d = new Date()) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
};

// ─── LIST ALL GROUPS ─────────────────────────────────────────────────────────
router.get("/all", verifyToken, async (req, res) => {
    try {
        const groups = await Group.find().populate('members', 'fullname username profile_picture');
        res.status(200).json(groups);
    } catch (e) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── CREATE GROUP ────────────────────────────────────────────────────────────
router.post("/create", verifyToken, [
    body('name').notEmpty().trim().escape().isLength({ min: 3, max: 50 }),
    body('description').optional().trim().escape().isLength({ max: 500 }),
    body('isPrivate').optional().isBoolean(),
    body('isAccountabilityCircle').optional().isBoolean(),
    body('maxMembers').optional().isInt({ min: 5, max: 10 }),
    body('cover_picture').optional().isURL(),
    validate
], async (req, res) => {
    try {
        let { name, description, isPrivate, isAccountabilityCircle, maxMembers, cover_picture } = req.body;
        
        if (isAccountabilityCircle) {
            isPrivate = true; // Accountability circles are strictly private
            if (!maxMembers || maxMembers < 5 || maxMembers > 10) {
                maxMembers = 10;
            }
        }

        const newGroup = new Group({
            name,
            description,
            isPrivate,
            isAccountabilityCircle: !!isAccountabilityCircle,
            maxMembers: isAccountabilityCircle ? maxMembers : undefined,
            cover_picture,
            creator: req.userId,
            members: [req.userId],
            admins: [req.userId]
        });
        await newGroup.save();
        res.status(201).json(newGroup);
    } catch (e) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── JOIN GROUP ──────────────────────────────────────────────────────────────
router.post("/join/:id", verifyToken, [
    param('id').isMongoId().withMessage('Invalid group ID'),
    validate
], async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) return res.status(404).json({ message: "Group not found" });
        if (group.members.includes(req.userId)) return res.status(400).json({ message: "Already a member" });

        if (group.isAccountabilityCircle && group.members.length >= (group.maxMembers || 10)) {
            return res.status(400).json({ message: "This Accountability Circle has reached its member limit (5-10 people)." });
        }

        group.members.push(req.userId);
        await group.save();
        res.status(200).json(group);
    } catch (e) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── LEAVE GROUP ─────────────────────────────────────────────────────────────
router.post("/leave/:id", verifyToken, [
    param('id').isMongoId().withMessage('Invalid group ID'),
    validate
], async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) return res.status(404).json({ message: "Group not found" });
        
        group.members = group.members.filter(m => m.toString() !== req.userId);
        group.admins = group.admins.filter(a => a.toString() !== req.userId);
        
        await group.save();
        res.status(200).json({ message: "Left group" });
    } catch (e) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── GET GROUP DETAILS ───────────────────────────────────────────────────────
router.get("/:id", verifyToken, [
    param('id').isMongoId().withMessage('Invalid group ID'),
    validate
], async (req, res) => {
    try {
        const group = await Group.findById(req.params.id)
            .populate('members', 'fullname username profile_picture')
            .populate({
                path: 'posts',
                populate: { path: 'user', select: 'fullname username profile_picture' }
            });
        if (!group) return res.status(404).json({ message: "Group not found" });
        res.status(200).json(group);
    } catch (e) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── GET WEEKLY CHECK-INS ───────────────────────────────────────────────────
router.get("/:id/checkins", verifyToken, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) return res.status(404).json({ message: "Group not found" });
        if (!group.members.includes(req.userId)) {
            return res.status(403).json({ message: "Access denied. You must be a member of this group." });
        }

        const checkins = await AccountabilityCheckIn.find({ group: req.params.id })
            .populate('user', 'fullname username profile_picture')
            .populate('feedback.user', 'fullname username profile_picture')
            .sort({ weekStarting: -1, createdAt: -1 });

        res.status(200).json(checkins);
    } catch (e) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── CREATE/UPDATE WIP CHECK-IN ──────────────────────────────────────────────
router.post("/:id/checkin", verifyToken, [
    body('wipText').notEmpty().trim().escape().isLength({ min: 5, max: 500 }),
    validate
], async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) return res.status(404).json({ message: "Group not found" });
        if (!group.members.includes(req.userId)) {
            return res.status(403).json({ message: "Access denied. You must be a member of this group." });
        }

        const weekStarting = getStartOfWeek();
        
        let checkin = await AccountabilityCheckIn.findOne({
            group: req.params.id,
            user: req.userId,
            weekStarting
        });

        if (checkin) {
            checkin.wipText = req.body.wipText;
            await checkin.save();
        } else {
            checkin = new AccountabilityCheckIn({
                group: req.params.id,
                user: req.userId,
                weekStarting,
                wipText: req.body.wipText,
                status: 'pending'
            });
            await checkin.save();
        }

        const populated = await AccountabilityCheckIn.findById(checkin._id)
            .populate('user', 'fullname username profile_picture')
            .populate('feedback.user', 'fullname username profile_picture');

        res.status(200).json(populated);
    } catch (e) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── TOGGLE CHECK-IN STATUS ───────────────────────────────────────────────
router.put("/:id/checkin/:checkInId/status", verifyToken, [
    body('status').isIn(['pending', 'completed', 'missed']),
    validate
], async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) return res.status(404).json({ message: "Group not found" });
        if (!group.members.includes(req.userId)) {
            return res.status(403).json({ message: "Access denied." });
        }

        const checkin = await AccountabilityCheckIn.findById(req.params.checkInId);
        if (!checkin) return res.status(404).json({ message: "Check-in not found" });

        if (checkin.user.toString() !== req.userId) {
            return res.status(403).json({ message: "Access denied. You can only update your own check-ins." });
        }

        checkin.status = req.body.status;
        await checkin.save();

        const populated = await AccountabilityCheckIn.findById(checkin._id)
            .populate('user', 'fullname username profile_picture')
            .populate('feedback.user', 'fullname username profile_picture');

        res.status(200).json(populated);
    } catch (e) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ─── ADD PEER FEEDBACK ───────────────────────────────────────────────────────
router.post("/:id/checkin/:checkInId/feedback", verifyToken, [
    body('text').notEmpty().trim().escape().isLength({ min: 1, max: 300 }),
    validate
], async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) return res.status(404).json({ message: "Group not found" });
        if (!group.members.includes(req.userId)) {
            return res.status(403).json({ message: "Access denied. You must be a member of this group." });
        }

        const checkin = await AccountabilityCheckIn.findById(req.params.checkInId);
        if (!checkin) return res.status(404).json({ message: "Check-in not found" });

        checkin.feedback.push({
            user: req.userId,
            text: req.body.text
        });
        await checkin.save();

        const populated = await AccountabilityCheckIn.findById(checkin._id)
            .populate('user', 'fullname username profile_picture')
            .populate('feedback.user', 'fullname username profile_picture');

        res.status(200).json(populated);
    } catch (e) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
