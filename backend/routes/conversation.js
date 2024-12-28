const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message')

// Create a new conversation
router.post('/create', async (req, res) => {
    try {
        const { participants } = req.body;

        if (!participants || participants.length !== 2) {
            return res.status(400).json({ error: 'Exactly two participants are required to create a conversation.' });
        }

        // Extract user IDs from participants
        const participantIds = participants.map(p => p.userId);

        // Check for an existing conversation with the same participants
        const existingConversation = await Conversation.findOne({
            'participants.userId': { $all: participantIds },
        });

        if (existingConversation) {
            return res.status(200).json(existingConversation); // Return the existing conversation
        }

        // Create a new conversation if none exists
        const conversation = new Conversation({
            participants,
        });

        await conversation.save();
        res.status(201).json(conversation);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fetch all conversations for a user
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // Find all conversations where the user is a participant
        const conversations = await Conversation.find({
            'participants.userId': userId,
        }).sort({ lastMessageAt: -1 });

        res.status(200).json(conversations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fetch all messages for a user
router.post('/messages', async (req, res) => {
    try {
        const { participantIds } = req.body;

        if (!participantIds || participantIds.length !== 2) {
            return res.status(400).json({ error: 'Exactly two participant IDs are required to fetch a conversation.' });
        }

        // Find the conversation with the specified participants
        const conversation = await Conversation.findOne({
            'participants.userId': { $all: participantIds },
        });

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found.' });
        }

        // Fetch messages related to the conversation
        const messages = await Message.find({ conversationId: conversation._id });

        res.status(200).json({ messages, conversation });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


router.post('/messages/create', async (req, res) => {
    const { conversationId, sender, content } = req.body;

    if (!conversationId || !sender || !content) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const message = new Message({
            conversationId,
            sender,
            content,
        });

        // Save the message to the database
        const savedMessage = await message.save();

        // Update the last message in the conversation
        await Conversation.findByIdAndUpdate(
            conversationId,
            { lastMessage: content, lastMessageAt: Date.now(),lastMessageBy: sender },
                { new: true }
        );

        res.status(201).json(savedMessage);
    } catch (error) {
        console.error('Error creating message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route to mark messages as read
router.patch('/messages/mark-read', async (req, res) => {
    const { messageIds } = req.body;

    if (!messageIds || !Array.isArray(messageIds)) {
        return res.status(400).json({ error: 'Invalid message IDs' });
    }

    try {
        await Message.updateMany(
            { _id: { $in: messageIds } },
            { $set: { isRead: true } }
        );
        res.json({ message: 'Messages marked as read', messageIds });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update messages' });
    }
});


module.exports = router;
