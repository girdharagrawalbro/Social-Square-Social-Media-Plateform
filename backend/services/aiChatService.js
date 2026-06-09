const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { UserInterest } = require('../models/Recommendation');
const { generateNvidiaChat } = require('../utils/nvidia');
const mongoose = require('mongoose');

let _io = null;

function setIo(io) {
    _io = io;
}

/**
 * Triggers an AI reply to a user message in a DM conversation.
 */
async function triggerAiReply(conversationId, userSenderId, userMessageContent, aiUser) {
    try {
        console.log(`[AI Chat] Triggering reply in conv: ${conversationId} for user: ${userSenderId}`);

        // Fetch last 10 messages of the conversation for history context
        const messageHistory = await Message.find({ conversationId })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        // Sort chronological (oldest first)
        messageHistory.reverse();

        const formattedHistory = messageHistory
            .filter(m => !m.deletedAt && m.content)
            .map(m => ({
                role: String(m.sender) === String(aiUser._id) ? 'assistant' : 'user',
                content: m.content
            }));

        const systemPrompt = {
            role: 'system',
            content: "You are Social Square AI, the official bot for the Social Square social media platform. You are replying to a direct message from a user. " +
                "Answer in a very friendly, respectful, and short manner (10 to 30 words, 1-2 sentences max). " +
                "Use Hinglish or English matching the user's message tone and language. " +
                "Do not repeat the user's message, do not add placeholders, and do not use generic AI intro/outro. Direct response only."
        };

        const messages = [systemPrompt, ...formattedHistory];

        const aiResponseText = await generateNvidiaChat(messages);
        const replyText = (aiResponseText || '').trim();

        if (!replyText) {
            console.warn('[AI Chat] Empty response from NVIDIA model');
            return;
        }

        // Save AI reply to DB
        let replyMsg = await Message.create({
            conversationId,
            sender: aiUser._id,
            content: replyText
        });

        // Update conversation metadata
        const updatedConv = await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: {
                id: replyMsg._id,
                message: replyMsg.content,
                isRead: false,
                isReply: false
            },
            lastMessageAt: new Date(),
            lastMessageBy: aiUser._id
        }, { new: true }).lean();

        // Create in-app notification
        const notification = await Notification.create({
            recipient: userSenderId,
            sender: {
                id: aiUser._id,
                fullname: aiUser.fullname,
                profile_picture: aiUser.profile_picture
            },
            message: {
                id: replyMsg._id,
                content: replyMsg.content
            }
        });

        // Broadcast Socket.io events
        if (_io) {
            const msgObj = {
                ...replyMsg.toObject(),
                senderId: aiUser._id,
                senderName: aiUser.fullname
            };

            const participants = updatedConv.participants.map(p => p.userId.toString());
            participants.forEach(p => {
                _io.to(p).emit('receiveMessage', msgObj);
                _io.to(p).emit('conversationUpdated', updatedConv);
            });

            _io.to(userSenderId.toString()).emit('newNotification', {
                ...notification.toObject(),
                sender: {
                    id: aiUser._id,
                    fullname: aiUser.fullname,
                    profile_picture: aiUser.profile_picture
                }
            });
        }

        // console.log('[AI Chat] AI reply sent successfully');
    } catch (err) {
        console.error('[AI Chat Error] triggerAiReply failed:', err);
    }
}

/**
 * Sends a personalized welcome DM to a user who followed the AI bot.
 */
async function triggerAiWelcomeMessage(userId, aiUser) {
    try {
        // console.log(`[AI Chat] Waiting 10 seconds before generating welcome message for user: ${userId}`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        // console.log(`[AI Chat] Generating welcome message for user: ${userId}`);

        const [user, userInterest] = await Promise.all([
            User.findById(userId).select('fullname bio').lean(),
            UserInterest.findOne({ userId }).lean()
        ]);

        if (!user) {
            console.error('[AI Chat] User not found for welcome message:', userId);
            return;
        }

        // Find or create a DM conversation between user and AI
        let conv = await Conversation.findOne({
            isGroup: false,
            'participants.userId': { $all: [new mongoose.Types.ObjectId(userId), aiUser._id] }
        });

        if (!conv) {
            const senderUser = aiUser;
            const recipientUser = user;
            conv = await Conversation.create({
                participants: [
                    { userId: senderUser._id, fullname: senderUser.fullname, profilePicture: senderUser.profile_picture || '' },
                    { userId: recipientUser._id, fullname: recipientUser.fullname, profilePicture: recipientUser.profile_picture || '' }
                ]
            });
        }

        const systemPrompt = "You are Social Square AI, the official bot for the Social Square social media platform. A user has just followed you! " +
            "Send a direct welcome message to the user. " +
            "Tailor the message using their name, bio, and top interests to welcome them in a warm, respectful, and friendly way. " +
            "Keep it extremely short (10 to 30 words, 1-2 sentences max). " +
            "Use Hinglish or English matching their profile/interests. " +
            "Do not write placeholders like [Name] or [Interests]. Write a complete, ready-to-send message.";

        const interestsList = (userInterest?.topCategories || []).join(', ');
        const tagsList = (userInterest?.likedTags || []).join(', ');
        const userPrompt = `User Details:\nName: ${user.fullname}\nBio: ${user.bio || 'None'}\nTop Interests: ${interestsList || 'None'}\nLiked Tags: ${tagsList || 'None'}`;

        const aiResponseText = await generateNvidiaChat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ]);

        const welcomeText = (aiResponseText || '').trim();
        if (!welcomeText) {
            console.warn('[AI Chat] Empty welcome response from NVIDIA model');
            return;
        }

        // Save welcome message to DB
        let welcomeMsg = await Message.create({
            conversationId: conv._id,
            sender: aiUser._id,
            content: welcomeText
        });

        // Update conversation metadata
        const updatedConv = await Conversation.findByIdAndUpdate(conv._id, {
            lastMessage: {
                id: welcomeMsg._id,
                message: welcomeMsg.content,
                isRead: false,
                isReply: false
            },
            lastMessageAt: new Date(),
            lastMessageBy: aiUser._id
        }, { new: true }).lean();

        // Create in-app notification
        const notification = await Notification.create({
            recipient: userId,
            sender: {
                id: aiUser._id,
                fullname: aiUser.fullname,
                profile_picture: aiUser.profile_picture
            },
            message: {
                id: welcomeMsg._id,
                content: welcomeMsg.content
            }
        });

        // Broadcast Socket.io events
        if (_io) {
            const msgObj = {
                ...welcomeMsg.toObject(),
                senderId: aiUser._id,
                senderName: aiUser.fullname
            };

            const participants = updatedConv.participants.map(p => p.userId.toString());
            participants.forEach(p => {
                _io.to(p).emit('receiveMessage', msgObj);
                _io.to(p).emit('conversationUpdated', updatedConv);
            });

            _io.to(userId.toString()).emit('newNotification', {
                ...notification.toObject(),
                sender: {
                    id: aiUser._id,
                    fullname: aiUser.fullname,
                    profile_picture: aiUser.profile_picture
                }
            });
        }

        console.log('[AI Chat] Welcome message sent successfully');
    } catch (err) {
        console.error('[AI Chat Error] triggerAiWelcomeMessage failed:', err);
    }
}

module.exports = {
    setIo,
    triggerAiReply,
    triggerAiWelcomeMessage
};
