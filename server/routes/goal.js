const express = require('express');
const router = express.Router();
const Goal = require('../models/Goal');
const verifyToken = require('../middleware/Verifytoken');

// Helper to recalculate goal progress percentage
const recalculateProgress = (milestones) => {
  if (!milestones || milestones.length === 0) return 0;
  const completed = milestones.filter(m => m.isCompleted).length;
  return Math.round((completed / milestones.length) * 100);
};

// Create a goal
router.post('/create', verifyToken, async (req, res) => {
  try {
    const { title, description, targetDate, milestones } = req.body;
    if (!title || !targetDate) {
      return res.status(400).json({ error: 'Title and target date are required.' });
    }

    const milestoneObjects = (milestones || []).map(m => ({
      title: m.title,
      isCompleted: false,
      completedAt: null,
      cheers: []
    }));

    const newGoal = new Goal({
      user: req.userId,
      title,
      description,
      targetDate: new Date(targetDate),
      milestones: milestoneObjects,
      progress: 0,
      status: 'active'
    });

    await newGoal.save();
    res.status(201).json(newGoal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create goal.' });
  }
});

// Fetch all public goals of a user
router.get('/user/:userId', async (req, res) => {
  try {
    const goals = await Goal.find({ user: req.params.userId }).sort({ createdAt: -1 });
    res.json(goals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch goals.' });
  }
});

// Update a goal (Owner only)
router.put('/:goalId', verifyToken, async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.goalId);
    if (!goal) return res.status(404).json({ error: 'Goal not found.' });

    if (goal.user.toString() !== req.userId.toString()) {
      return res.status(433).json({ error: 'Unauthorized to update this goal.' });
    }

    const { title, description, targetDate, status } = req.body;
    if (title) goal.title = title;
    if (description !== undefined) goal.description = description;
    if (targetDate) goal.targetDate = new Date(targetDate);
    if (status) goal.status = status;

    await goal.save();
    res.json(goal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update goal.' });
  }
});

// Add milestone (Owner only)
router.post('/:goalId/milestone', verifyToken, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'Milestone title is required.' });

    const goal = await Goal.findById(req.params.goalId);
    if (!goal) return res.status(404).json({ error: 'Goal not found.' });

    if (goal.user.toString() !== req.userId.toString()) {
      return res.status(433).json({ error: 'Unauthorized.' });
    }

    goal.milestones.push({ title, isCompleted: false, completedAt: null, cheers: [] });
    goal.progress = recalculateProgress(goal.milestones);
    
    await goal.save();
    res.status(201).json(goal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add milestone.' });
  }
});

// Toggle milestone completion (Owner only)
router.put('/:goalId/milestone/:milestoneId', verifyToken, async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.goalId);
    if (!goal) return res.status(404).json({ error: 'Goal not found.' });

    if (goal.user.toString() !== req.userId.toString()) {
      return res.status(433).json({ error: 'Unauthorized.' });
    }

    const milestone = goal.milestones.id(req.params.milestoneId);
    if (!milestone) return res.status(404).json({ error: 'Milestone not found.' });

    milestone.isCompleted = !milestone.isCompleted;
    milestone.completedAt = milestone.isCompleted ? new Date() : null;
    goal.progress = recalculateProgress(goal.milestones);

    await goal.save();
    res.json(goal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update milestone.' });
  }
});

// Delete a milestone (Owner only)
router.delete('/:goalId/milestone/:milestoneId', verifyToken, async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.goalId);
    if (!goal) return res.status(404).json({ error: 'Goal not found.' });

    if (goal.user.toString() !== req.userId.toString()) {
      return res.status(433).json({ error: 'Unauthorized.' });
    }

    goal.milestones.pull(req.params.milestoneId);
    goal.progress = recalculateProgress(goal.milestones);

    await goal.save();
    res.json(goal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete milestone.' });
  }
});

// Toggle cheer on overall goal
router.post('/:goalId/cheer', verifyToken, async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.goalId);
    if (!goal) return res.status(404).json({ error: 'Goal not found.' });

    const index = goal.cheers.indexOf(req.userId);
    if (index === -1) {
      goal.cheers.push(req.userId);
    } else {
      goal.cheers.splice(index, 1);
    }

    await goal.save();
    res.json(goal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to cheer.' });
  }
});

// Toggle cheer on a milestone
router.post('/:goalId/milestone/:milestoneId/cheer', verifyToken, async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.goalId);
    if (!goal) return res.status(404).json({ error: 'Goal not found.' });

    const milestone = goal.milestones.id(req.params.milestoneId);
    if (!milestone) return res.status(404).json({ error: 'Milestone not found.' });

    const index = milestone.cheers.indexOf(req.userId);
    if (index === -1) {
      milestone.cheers.push(req.userId);
    } else {
      milestone.cheers.splice(index, 1);
    }

    await goal.save();
    res.json(goal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to cheer milestone.' });
  }
});

// Delete goal (Owner only)
router.delete('/:goalId', verifyToken, async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.goalId);
    if (!goal) return res.status(404).json({ error: 'Goal not found.' });

    if (goal.user.toString() !== req.userId.toString()) {
      return res.status(433).json({ error: 'Unauthorized to delete this goal.' });
    }

    await Goal.findByIdAndDelete(req.params.goalId);
    res.json({ success: true, message: 'Goal deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete goal.' });
  }
});

module.exports = router;
