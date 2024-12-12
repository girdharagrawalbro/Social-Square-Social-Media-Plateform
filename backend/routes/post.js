const express = require('express');
const Post = require('../models/Post');
const User = require('../models/User');
const Category = require("../models/Category");

const router = express.Router();

router.post("/create", async (req, res) => {
  try {
    const { caption, loggeduser, category, imageURL } = req.body;

    // Validate fields
    if (!caption || !loggeduser || !category) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Fetch user details from the database
    const userDetails = await User.findById(loggeduser).select('username fullname profile_picture');
    if (!userDetails) {
      return res.status(404).json({ message: "User not found." });
    }

    // Create new post with user details
    const newPost = new Post({
      caption,
      category,
      image_url: imageURL,
      user: {
        _id: userDetails._id,
        fullname: userDetails.fullname,
        profile_picture: userDetails.profile_picture,
      },
    });

    await newPost.save();
    res.status(201).json(newPost);
  } catch (error) {
    console.error("Error creating post:", error.message);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});


router.get("/", async (req, res) => {
  try {
    // Fetch posts and sort them in descending order by createdAt or updatedAt
    const posts = await Post.find().sort({ updatedAt: -1, createdAt: -1 });
    res.status(200).json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
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
    const post = await Post.findById(postId);

    if (!post.likes.includes(userId)) {
      post.likes.push(userId);
      await post.save();
      res.status(200).json({ message: "Post liked successfully!" });
    } else {
      res.status(400).json({ message: "You already liked this post." });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/unlike", async (req, res) => {
  try {
    const { postId, userId } = req.body;
    const post = await Post.findById(postId);

    if (post.likes.includes(userId)) {
      post.likes = post.likes.filter((id) => id !== userId);
      await post.save();
      res.status(200).json({ message: "Post unliked successfully!" });
    } else {
      res.status(400).json({ message: "You haven't liked this post." });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});



module.exports = router;
