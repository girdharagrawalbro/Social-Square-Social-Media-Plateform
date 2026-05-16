const express = require("express");
const router = express.Router();
const Group = require("../models/Group");
const verifyToken = require("../middleware/Verifytoken");
const { body, param, validationResult } = require('express-validator');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
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
    body('cover_picture').optional().isURL(),
    validate
], async (req, res) => {
    try {
        const { name, description, isPrivate, cover_picture } = req.body;
        const newGroup = new Group({
            name,
            description,
            isPrivate,
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

module.exports = router;
