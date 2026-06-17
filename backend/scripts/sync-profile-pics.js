require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');

const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Story = require('../models/Story');
const LiveChatMessage = require('../models/LiveChatMessage');
const Notification = require('../models/Notification');

async function connectDB() {
    await mongoose.connect("mongodb+srv://girdharagrawalbro:7909905038@cluster0.czsb19m.mongodb.net/socialsquare?retryWrites=true&w=majority&appName=Cluster0");
    console.log('Connected to MongoDB');
}

async function syncProfilePics() {
    console.log('--- Syncing Profile Pics Across Models ---');
    
    // Find users with a valid profile_picture
    const users = await User.find({ profile_picture: { $exists: true, $ne: '' } });
    console.log(`Found ${users.length} users to sync.`);

    let totalPosts = 0;
    let totalCollaborators = 0;
    let totalComments = 0;
    let totalConversations = 0;
    let totalMessages = 0;
    let totalStories = 0;
    let totalLiveChatMessages = 0;
    let totalNotifications = 0;

    for (const user of users) {
        // 1. Post (author)
        const postRes = await Post.updateMany(
            { 'user._id': user._id },
            { $set: { 'user.profile_picture': user.profile_picture } }
        );
        totalPosts += postRes.modifiedCount;

        // 2. Post (collaborators)
        const collabRes = await Post.updateMany(
            { 'collaborators.userId': user._id },
            { $set: { 'collaborators.$.profile_picture': user.profile_picture } }
        );
        totalCollaborators += collabRes.modifiedCount;

        // 3. Comment
        const commentRes = await Comment.updateMany(
            { 'user._id': user._id },
            { $set: { 'user.profile_picture': user.profile_picture } }
        );
        totalComments += commentRes.modifiedCount;

        // 4. Conversation
        const convRes = await Conversation.updateMany(
            { 'participants.userId': user._id },
            { $set: { 'participants.$.profilePicture': user.profile_picture } }
        );
        totalConversations += convRes.modifiedCount;

        // 5. Message (sharedPost & storyReply) via username
        if (user.username) {
            const msgShareRes = await Message.updateMany(
                { 'sharedPost.authorUsername': user.username },
                { $set: { 'sharedPost.authorProfilePicture': user.profile_picture } }
            );
            totalMessages += msgShareRes.modifiedCount;

            const msgStoryRes = await Message.updateMany(
                { 'storyReply.authorUsername': user.username },
                { $set: { 'storyReply.authorProfilePicture': user.profile_picture } }
            );
            totalMessages += msgStoryRes.modifiedCount;
        }

        // 6. Story
        const storyRes = await Story.updateMany(
            { 'user._id': user._id },
            { $set: { 'user.profile_picture': user.profile_picture } }
        );
        totalStories += storyRes.modifiedCount;

        // 7. LiveChatMessage
        const liveChatRes = await LiveChatMessage.updateMany(
            { 'user.id': user._id },
            { $set: { 'user.profile_picture': user.profile_picture } }
        );
        totalLiveChatMessages += liveChatRes.modifiedCount;

        // 8. Notification
        const notifRes = await Notification.updateMany(
            { 'sender.id': user._id },
            { $set: { 'sender.profile_picture': user.profile_picture } }
        );
        totalNotifications += notifRes.modifiedCount;
    }

    console.log(`Updated Posts (author): ${totalPosts}`);
    console.log(`Updated Posts (collaborators): ${totalCollaborators}`);
    console.log(`Updated Comments: ${totalComments}`);
    console.log(`Updated Conversations: ${totalConversations}`);
    console.log(`Updated Messages (shares/replies): ${totalMessages}`);
    console.log(`Updated Stories: ${totalStories}`);
    console.log(`Updated LiveChatMessages: ${totalLiveChatMessages}`);
    console.log(`Updated Notifications: ${totalNotifications}`);
}

async function run() {
    await connectDB();
    await syncProfilePics();
    console.log('--- Sync Complete ---');
    process.exit(0);
}

run().catch(console.error);
