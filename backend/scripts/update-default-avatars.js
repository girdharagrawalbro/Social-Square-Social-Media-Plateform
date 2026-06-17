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

const OLD_URL = "https://th.bing.com/th/id/OIP.S171c9HYsokHyCPs9brbPwHaGP?rs=1&pid=ImgDetMain";
const NEW_URL = "https://res.cloudinary.com/dcmrsdydh/image/upload/v1773920333/9e837528f01cf3f42119c5aeeed1b336_qf6lzf.jpg";

async function connectDB() {
    await mongoose.connect("mongodb+srv://girdharagrawalbro:7909905038@cluster0.czsb19m.mongodb.net/socialsquare?retryWrites=true&w=majority&appName=Cluster0");
    console.log('Connected to MongoDB');
}

async function updateDefaultAvatars() {
    console.log(`--- Replacing old default avatars with new default avatar ---`);
    console.log(`Old: ${OLD_URL}`);
    console.log(`New: ${NEW_URL}`);

    // 1. User
    const userRes = await User.updateMany(
        { profile_picture: OLD_URL },
        { $set: { profile_picture: NEW_URL } }
    );
    console.log(`Updated Users: ${userRes.modifiedCount}`);

    // 2. Post (author)
    const postRes = await Post.updateMany(
        { 'user.profile_picture': OLD_URL },
        { $set: { 'user.profile_picture': NEW_URL } }
    );
    console.log(`Updated Posts (author): ${postRes.modifiedCount}`);

    // 3. Post (collaborators)
    const collabRes = await Post.updateMany(
        { 'collaborators.profile_picture': OLD_URL },
        { $set: { 'collaborators.$.profile_picture': NEW_URL } }
    );
    console.log(`Updated Posts (collaborators): ${collabRes.modifiedCount}`);

    // 4. Comment
    const commentRes = await Comment.updateMany(
        { 'user.profile_picture': OLD_URL },
        { $set: { 'user.profile_picture': NEW_URL } }
    );
    console.log(`Updated Comments: ${commentRes.modifiedCount}`);

    // 5. Conversation
    const convRes = await Conversation.updateMany(
        { 'participants.profilePicture': OLD_URL },
        { $set: { 'participants.$[elem].profilePicture': NEW_URL } },
        { arrayFilters: [{ 'elem.profilePicture': OLD_URL }] }
    );
    console.log(`Updated Conversations: ${convRes.modifiedCount}`);

    // 6. Message (sharedPost & storyReply)
    const msgShareRes = await Message.updateMany(
        { 'sharedPost.authorProfilePicture': OLD_URL },
        { $set: { 'sharedPost.authorProfilePicture': NEW_URL } }
    );
    const msgStoryRes = await Message.updateMany(
        { 'storyReply.authorProfilePicture': OLD_URL },
        { $set: { 'storyReply.authorProfilePicture': NEW_URL } }
    );
    console.log(`Updated Messages (shares/replies): ${msgShareRes.modifiedCount + msgStoryRes.modifiedCount}`);

    // 7. Story
    const storyRes = await Story.updateMany(
        { 'user.profile_picture': OLD_URL },
        { $set: { 'user.profile_picture': NEW_URL } }
    );
    console.log(`Updated Stories: ${storyRes.modifiedCount}`);

    // 8. LiveChatMessage
    const liveChatRes = await LiveChatMessage.updateMany(
        { 'user.profile_picture': OLD_URL },
        { $set: { 'user.profile_picture': NEW_URL } }
    );
    console.log(`Updated LiveChatMessages: ${liveChatRes.modifiedCount}`);

    // 9. Notification
    const notifRes = await Notification.updateMany(
        { 'sender.profile_picture': OLD_URL },
        { $set: { 'sender.profile_picture': NEW_URL } }
    );
    console.log(`Updated Notifications: ${notifRes.modifiedCount}`);
}

async function run() {
    await connectDB();
    await updateDefaultAvatars();
    console.log('--- Avatar Update Complete ---');
    process.exit(0);
}

run().catch(console.error);
