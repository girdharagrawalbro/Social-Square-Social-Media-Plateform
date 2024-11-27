const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

const JWT_SECRET = 'your_jwt_secret'; // Replace with a secure environment variable

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
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Registration (Signup) endpoint
router.post('/add', async (req, res) => {
    try {
        const { fullname, email, password } = req.body;

        // Check if a user with the same identifier exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email.' });
        }

        // Create a new user instance with plaintext password
        const newUser = new User({
            fullname,
            email,
            password, // Storing plaintext password (not recommended, hash it in production)
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
        console.error(error);
        res.status(500).json({ message: 'Failed to register user, please try again.' });
    }
});

// Get user details endpoint
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

// Update profile endpoint
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

        // Send the updated user data as a response
        res.status(200).json(updatedUser);
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Failed to update profile.' });
    }
});

// View all users endpoint
router.get('/view', async (req, res) => {
    try {
        const { userId } = req.query; // Extract logged-in user ID from query parameters
        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        // Fetch all users except the logged-in user
        const users = await User.find({ _id: { $ne: userId } });
        res.status(200).json({ users });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve users, please try again.' });
    }
});


module.exports = router;