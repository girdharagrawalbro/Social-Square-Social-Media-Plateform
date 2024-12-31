const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message')
const Notification = require('../models/Notification')

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
    const { conversationId, sender, senderName, content, recipientId } = req.body;

    if (!conversationId || !sender || !content || !recipientId || !senderName) {
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

        const notification = await new Notification({
            recipient: recipientId,
            sender: {
                id: sender,
                fullname: senderName,
            },
            message: {
                id: savedMessage._id,
                content
            },
        })

        await notification.save();
        console.log(notification)
        // Update the last message in the conversation
        await Conversation.findByIdAndUpdate(
            conversationId,
            { lastMessage: { id: savedMessage._id, message: content }, lastMessageAt: Date.now(), lastMessageBy: sender },
            { new: true }
        );

        res.status(201).json(savedMessage);
    } catch (error) {
        console.error('Error creating message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route to mark messages as read
router.post('/messages/mark-read', async (req, res) => {
    const { unreadMessageIds, lastMessage } = req.body;

    if (!unreadMessageIds || !Array.isArray(unreadMessageIds)) {
        return res.status(400).json({ error: 'Invalid message IDs' });
    }

    try {
        // Mark all specified messages as read
        await Message.updateMany(
            { _id: { $in: unreadMessageIds } },
            { $set: { isRead: true } }
        );

        // If lastMessage is provided, update the conversation's lastMessage
        if (lastMessage) {
            const lastmessagedata = await Message.findById(lastMessage);

            if (!lastmessagedata) {
                return res.status(404).json({ error: 'Last message not found' });
            }

            await Conversation.findByIdAndUpdate(
                lastmessagedata.conversationId, // Ensure the correct conversation ID is used
                {
                    lastMessage: {
                        id: lastmessagedata._id,
                        message: lastmessagedata.content,
                        isRead: true,
                    },
                    lastMessageBy: lastmessagedata.sender,
                    lastMessageAt: lastmessagedata.createdAt,
                },
                { new: true }
            );
        }

        res.json({ message: 'Messages marked as read', unreadMessageIds });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({ error: 'Failed to update messages' });
    }
});

// Assuming you're using Express
router.get('/notifications/:userId', async (req, res) => {
    try {
        const { userId } = req.params;  // Change to use query params
        if (!userId) {
            return res.status(400).json({ error: "No user id provided" });
        }

        // Find all notifications where the user is the recipient
        const notifications = await Notification.find({
            recipient: userId,
            read: false
        }).sort({ createdAt: -1 });  // Sort by creation date (or adjust this as per your need)

        res.status(200).json(notifications);  // Return the notifications
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.patch('/notifications/mark-read', async (req, res) => {
    const { Ids } = req.body;
    console.log(Ids)
    if (!Ids || !Array.isArray(Ids)) {
        return res.status(400).json({ error: 'Invalid message IDs' });
    }

    try {
        await Notification.updateMany(
            { _id: { $in: Ids } },
            { $set: { read: true } }
        );
        res.json({ Ids });
    } catch (err) {
        res.status(500).json({ error: 'Error marking notification as read:', err });
    }
});

module.exports = router;
