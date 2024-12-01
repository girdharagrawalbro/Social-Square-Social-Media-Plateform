const express = require('express');
const Post = require('../models/Post');
const User = require('../models/User');
const Category = require("../models/Category");

const router = express.Router();

router.post("/create", async (req, res) => {
  try {
    const { caption, user, category,imageURL } = req.body;

    // Validate fields
    if (!caption || !user || !category) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Fetch user details from the database
    const userDetails = await User.findById(user).select('username fullname profile_picture');
    if (!userDetails) {
      return res.status(404).json({ message: "User not found." });
    }

    // Create new post with user details
    const newPost = new Post({
      caption,
      category,
      image_url :imageURL,
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
