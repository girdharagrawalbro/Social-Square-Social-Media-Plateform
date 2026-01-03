const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Post = require("../models/Post");
const { decryptPassword, isEncrypted } = require('../utils/crypto');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('ERROR: JWT_SECRET is not defined in environment variables');
    process.exit(1);
}

// Login endpoint with validation
router.post('/login', [
    body('identifier').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { identifier, password } = req.body;

        // Decrypt password if encrypted from frontend
        const decryptedPassword = isEncrypted(password) ? decryptPassword(password) : password;

        // Check if the user exists
        const user = await User.findOne({ email: identifier.toLowerCase().trim() });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Compare password with hashed password
        const isPasswordValid = await bcrypt.compare(decryptedPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate JWT token
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

        // Return success response
        return res.status(200).json({
            message: 'Login successful',
            token,
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Registration (Signup) endpoint with validation
router.post('/add', [
    body('fullname').trim().isLength({ min: 2, max: 50 }).withMessage('Full name must be between 2 and 50 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
    try {
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { fullname, email, password } = req.body;

        // Decrypt password if encrypted from frontend
        const decryptedPassword = isEncrypted(password) ? decryptPassword(password) : password;

        // Check if a user with the same email exists
        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email.' });
        }

        // Hash the password with bcrypt
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(decryptedPassword, saltRounds);

        // Create a new user instance with hashed password
        const newUser = new User({
            fullname: fullname.trim(),
            email: email.toLowerCase().trim(),
            password: hashedPassword,
        });

        // Save the new user to the database
        await newUser.save();

        // Generate a token after successful signup
        const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            message: 'User registered successfully!',
            token,
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Failed to register user, please try again.' });
    }
});

// Get logged user details using token
router.get('/get', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Unauthorized access. No token provided.' });
        }

        const token = authHeader.split(' ')[1]; // Extract the token

        try {
            const decoded = jwt.verify(token, JWT_SECRET); // Verify the token
            const userId = decoded.userId;

            // Find the user by ID
            const user = await User.findById(userId).select('-password'); // Exclude password

            if (!user) {
                return res.status(404).json({ message: 'User not found.' });
            }


            // Return the user data
            return res.status(200).json(user);
        } catch (error) {
            console.error('Invalid token:', error);
            return res.status(403).json({ message: 'Invalid or expired token.' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error.' });
    }
});
router.get("/other-users", async (req, res) => {
    try {
        const loggedUserId = req.headers.authorization; // Use token or header to get logged-in user ID

        if (!loggedUserId) {
            return res.status(400).json({ message: "Authorization header missing." });
        }

        const user = await User.findById(loggedUserId)
            .select("-password") // Exclude password field
            .populate("following", "_id"); // Populate following to get IDs only
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        // Fetch suggested users (not in following list and not the logged-in user)
        let suggestions = await User.find({
            _id: { $ne: loggedUserId, $nin: user.following }, // Exclude logged-in user and followed users
            followers: { $in: user.following }, // Suggest users followed by those in the following list
        })
            .limit(20)
            .select("_id fullname profile_picture");
        
        return res.status(200).json(suggestions);

    } catch (error) {
        console.error("Error fetching other users:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
});


// get follow - following user profile details
router.post('/users/details', async (req, res) => {
    const { ids } = req.body;

    try {
        // Fetch users from the database using the provided IDs
        const users = await User.find({ _id: { $in: ids } }).select('fullname profile_picture');
        res.status(200).json({ users });
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ error: 'Failed to fetch user details' });
    }
});

// Update profile 
router.put('/update-profile', async (req, res) => {
    try {
        // Extract user ID and form data from the request body
        const { userId, fullname, email, profile_picture, bio } = req.body;

        // Validate that userId is provided
        if (!userId) {
            return res.status(400).json({ message: 'User ID is required.' });
        }

        // Update the user in the database
        const updatedUser = await User.findByIdAndUpdate(
            userId, // Find the user by ID
            { fullname, email, profile_picture, bio }, // Update fields
            { new: true } // Return the updated document
        ).select('-password'); // Exclude the password field

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json(updatedUser);
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Failed to update profile.' });
    }
});



// Follow a user
router.post('/follow', async (req, res) => {
    try {
        const { userId, followUserId } = req.body;

        if (!userId || !followUserId) {
            return res.status(400).json({ message: 'Both userId and followUserId are required.' });
        }

        // Add followUserId to the user's following list and vice versa
        await User.findByIdAndUpdate(userId, { $addToSet: { following: followUserId } });
        const user = await User.findByIdAndUpdate(followUserId, { $addToSet: { followers: userId } }).select("-password");

        res.status(200).json(user);
    } catch (error) {
        console.error('Error following user:', error);
        res.status(500).json({ message: 'Failed to follow user.' });
    }
});

// Unfollow a user
router.post('/unfollow', async (req, res) => {
    try {
        const { userId, unfollowUserId } = req.body;

        if (!userId || !unfollowUserId) {
            return res.status(400).json({ message: 'Both userId and unfollowUserId are required.' });
        }

        // Remove unfollowUserId from the user's following list and vice versa
        await User.findByIdAndUpdate(userId, { $pull: { following: unfollowUserId } });
        const user = await User.findByIdAndUpdate(unfollowUserId, { $pull: { followers: userId } }).select("-password");

        res.status(200).json(user);
    } catch (error) {
        console.error('Error unfollowing user:', error);
        res.status(500).json({ message: 'Failed to unfollow user.' });
    }
});

// get details of a particular 
router.get('/other-user/view', async (req, res) => {
    try {
        const userId = req.headers.authorization;

        if (!userId) {
            return res.status(401).json({ message: 'No Id provided.' });
        }
        const user = await User.findById(userId).select('-password')

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        // Return the user data
        return res.status(200).json(user);
    }
    catch (error) {
        console.error(error);
        return res.status(403).json({ message: "Something went wrong" });
    }
});

// searched users 
router.post("/search", async (req, res) => {
    const { query } = req.body;

    if (!query) {
        return res.status(400).json({ message: "Search query is required." });
    }

    try {
        const [userResults, postResults] = await Promise.all([
            User.find({ fullname: { $regex: query, $options: "i" } }).select("-password"),
            Post.find({ category: { $regex: query, $options: "i" } }),
        ]);

        res.status(200).json({ users: userResults, posts: postResults });
    } catch (error) {
        console.error("Search error:", error);
        res.status(500).json({ message: "Internal server error." });
    }
});


module.exports = router;
