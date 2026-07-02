const { subscribe } = require('../lib/pubsub');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Feed = require('../models/Feed');
const Analytics = require('../models/Analytics');
const Post = require('../models/Post');


let _io;
function setIo(io) { _io = io; }

async function initPostSubscriber() {
    await subscribe('posts.created', async (data) => {
        console.log('[NATS] Received posts.created event:', data);
        const { id: postId, user, category } = data;

        const author = await User.findById(user._id).select('followers fullname profile_picture');
        const fullPost = await Post.findById(postId);
        console.log('[NATS] Author and Full Post found');


        const isAiPost = data.isAi || (user && user.username === 'social_square_ai');

        if (isAiPost) {
            console.log('[NATS] AI Post detected. Distributing to all active users...');
            const activeUsers = await User.find({ isBanned: { $ne: true }, deletedAt: null }).select('_id').lean();
            const recipientIds = activeUsers.map(u => u._id);

            if (recipientIds.length > 0) {
                const feedEntries = recipientIds.map(userId => ({ userId, post: postId }));
                await Feed.insertMany(feedEntries);
                console.log(`[NATS] AI Feed updated for ${recipientIds.length} users`);
            }

            if (_io && fullPost) {
                _io.emit('newFeedPost', fullPost);
                console.log('[NATS] AI newFeedPost broadcasted via Socket.io to everyone');
            }

            await Analytics.create({
                event: 'post.created', userId: user._id, postId, category,
                meta: { isAi: true, followersNotified: recipientIds.length },
            });
            console.log(`[NATS] AI post ${postId} analytics tracked`);
            return;
        }

        if (!author || !author.followers.length) {
            console.log('[NATS] No followers, skipping...');
            return;
        }

        const followerIds = author.followers;

        // 1. Save notifications to DB
        const notifications = followerIds.map(followerId => ({
            recipient: followerId,
            sender: { id: author._id, fullname: author.fullname, profile_picture: author.profile_picture },
            type: 'new_post',
            post: postId,
        }));
        const savedNotifications = await Notification.insertMany(notifications);
        console.log(`[NATS] Notifications saved for ${followerIds.length} followers`);

        // 2. Emit real-time socket notification to each follower
        if (_io) {
            savedNotifications.forEach(notification => {
                _io.to(notification.recipient.toString()).emit('newNotification', {
                    _id: notification._id,
                    type: notification.type,
                    sender: notification.sender,
                    post: notification.post,
                    createdAt: notification.createdAt,
                    read: notification.read,
                });
            });
            console.log(`[NATS] Real-time notifications emitted to ${followerIds.length} followers`);

            // 2b. Emit full post for instant feed update
            if (fullPost) {
                followerIds.forEach(followerId => {
                    _io.to(followerId.toString()).emit('newFeedPost', fullPost);
                });
                console.log(`[NATS] newFeedPost emitted to ${followerIds.length} followers`);
            }
        }


        // 3. Update followers' feeds
        const feedEntries = followerIds.map(followerId => ({ userId: followerId, post: postId }));
        await Feed.insertMany(feedEntries);
        console.log(`[NATS] Feed updated for ${followerIds.length} followers`);

        // 4. Track analytics
        await Analytics.create({
            event: 'post.created', userId: user._id, postId, category,
            meta: { followersNotified: followerIds.length },
        });
        console.log(`[NATS] Analytics tracked for post ${postId}`);
    });
}

module.exports = { initPostSubscriber, setIo };