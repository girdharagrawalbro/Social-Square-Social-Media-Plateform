const express = require('express');
const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Category = require("../models/Category");
const { emailQueue } = require("../queues/emailQueue");
const { publish } = require('../lib/nats');

const router = express.Router();

router.post("/create", async (req, res) => {
  try {
    const { caption, loggeduser, category, imageURLs } = req.body;
    if (!caption || !loggeduser || !category) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const userDetails = await User.findById(loggeduser).select('username fullname profile_picture');
    if (!userDetails) return res.status(404).json({ message: "User not found." });

    const newPost = new Post({
      caption,
      category,
      image_urls: Array.isArray(imageURLs) ? imageURLs : [],
      user: {
        _id: userDetails._id,
        fullname: userDetails.fullname,
        profile_picture: userDetails.profile_picture,
      },
    });

    await newPost.save();

    await emailQueue.add('sendWelcome', { userId: userDetails._id }, {
      attempts: 3, backoff: { type: 'exponential', delay: 5000 }
    });

    publish('posts.created', {
      id: newPost._id, user: newPost.user, category: newPost.category
    }).catch(err => console.warn('[NATS] publish failed:', err.message));

    res.status(201).json(newPost);
  } catch (error) {
    console.error("Error creating post:", error.message);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const posts = await Post.find().sort({ updatedAt: -1, createdAt: -1 });
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/categories", async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/like", async (req, res) => {
  try {
    const { postId, userId } = req.body;
    if (!userId || !postId) return res.status(400).json({ message: 'Both userId and postId are required.' });
    const post = await Post.findById(postId);
    if (!post.likes.includes(userId)) {
      post.likes.push(userId);
      await post.save();
      res.status(200).json({ message: "Success" });
    } else {
      res.status(400).json({ message: "You already liked this post." });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/unlike", async (req, res) => {
  try {
    const { postId, userId } = req.body;
    if (!userId || !postId) return res.status(400).json({ message: 'Both userId and postId are required.' });
    const post = await Post.findById(postId);
    if (post.likes.includes(userId)) {
      await Post.findByIdAndUpdate(postId, { $pull: { likes: userId } });
      res.status(200).json({ message: "success" });
    } else {
      res.status(400).json({ message: "You haven't liked this post." });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/comments', async (req, res) => {
  try {
    const postId = req.headers.authorization;
    if (!postId) return res.status(400).json({ error: 'postId is required' });
    const comments = await Comment.find({ postId });
    res.status(200).json(comments);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/comments/add', async (req, res) => {
  try {
    const { content, postId, user } = req.body;
    if (!content || !postId || !user) return res.status(400).json({ error: 'Invalid request data' });
    const newComment = new Comment({ postId, content, user });
    await newComment.save();
    const post = await Post.findById(postId);
    post.comments.push(newComment._id);
    await post.save();
    return res.status(200).json(newComment);
  } catch (error) { return res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;