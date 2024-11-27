const express = require('express');
const Post = require('../models/Post');
const Category = require("../models/Category");

const router = express.Router();
router.post("/create", async (req, res) => {
  try {
    const { caption, user, category } = req.body;

    // Validate fields
    if (!caption || !user || !category) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const newPost = new Post({
      caption,
      category,
      user: {
        username: user.username,
        fullname: user.fullname,
        profile_picture: user.profile_picture,
      },
    });

    await newPost.save();
    res.status(201).json(newPost);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});


router.get("/", async (req, res) => {
  try {
    const posts = await Post.find();
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

module.exports = router;
