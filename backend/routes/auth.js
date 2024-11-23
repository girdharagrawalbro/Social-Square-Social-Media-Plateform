const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

const JWT_SECRET = 'your_jwt_secret'; // Replace with a secure environment variable.

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;

        // Check if the user exists
        const user = await User.findOne({ email: identifier });
        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate JWT token
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

        // Return success response
        return res.status(200).json({
            message: 'Login successful',
            token,
            userId: user._id,
            fullname: user.fullname,
            email: user.email,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Registration (Signup) endpoint
router.post('/add', async (req, res) => {
    try {
        const { fullname, identifier, password } = req.body;

        // Check if a user with the same identifier exists
        const existingUser = await User.findOne({ email: identifier });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email.' });
        }

        // Create a new user instance with plaintext password
        const newUser = new User({
            fullname,
            email: identifier,
            password, // Storing plaintext password (not recommended)
        });

        // Save the new user to the database
        await newUser.save();

        // Generate a token after successful signup
        const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            message: 'User registered successfully!',
            token,
            userId: newUser._id,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to register user, please try again.' });
    }
});

// Optional: View all users
router.get('/view', async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve users, please try again.' });
    }
});

module.exports = router;
