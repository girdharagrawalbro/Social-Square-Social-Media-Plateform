const express = require('express');
const router = express.Router();
const Idea = require('../models/Idea');
const verifyToken = require('../middleware/Verifytoken');

// Create a killed idea
router.post('/create', verifyToken, async (req, res) => {
  try {
    const { title, description, killedReason, lessonsLearned, tags } = req.body;
    if (!title || !description || !killedReason) {
      return res.status(400).json({ error: 'Title, description, and reason for killing are required.' });
    }

    const newIdea = new Idea({
      user: req.userId,
      title,
      description,
      killedReason,
      lessonsLearned: lessonsLearned || '',
      tags: tags || [],
      status: 'abandoned'
    });

    await newIdea.save();
    res.status(201).json(newIdea);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create killed idea.' });
  }
});

// Fetch all killed ideas of a user
router.get('/user/:userId', async (req, res) => {
  try {
    const ideas = await Idea.find({ user: req.params.userId }).sort({ createdAt: -1 });
    res.json(ideas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch killed ideas.' });
  }
});

// Update a killed idea (Owner only)
router.put('/:ideaId', verifyToken, async (req, res) => {
  try {
    const idea = await Idea.findById(req.params.ideaId);
    if (!idea) return res.status(404).json({ error: 'Idea not found.' });

    if (idea.user.toString() !== req.userId) {
      return res.status(433).json({ error: 'Unauthorized to update this idea.' });
    }

    const { title, description, killedReason, lessonsLearned, tags, status } = req.body;
    if (title) idea.title = title;
    if (description) idea.description = description;
    if (killedReason) idea.killedReason = killedReason;
    if (lessonsLearned !== undefined) idea.lessonsLearned = lessonsLearned;
    if (tags) idea.tags = tags;
    if (status) idea.status = status;

    await idea.save();
    res.json(idea);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update idea.' });
  }
});

// Delete a killed idea (Owner only)
router.delete('/:ideaId', verifyToken, async (req, res) => {
  try {
    const idea = await Idea.findById(req.params.ideaId);
    if (!idea) return res.status(404).json({ error: 'Idea not found.' });

    if (idea.user.toString() !== req.userId) {
      return res.status(433).json({ error: 'Unauthorized to delete this idea.' });
    }

    await Idea.findByIdAndDelete(req.params.ideaId);
    res.json({ success: true, message: 'Killed idea deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete idea.' });
  }
});

module.exports = router;
