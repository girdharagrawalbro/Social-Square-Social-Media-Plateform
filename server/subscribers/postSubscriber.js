const { subscribe } = require('../lib/pubsub');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Feed = require('../models/Feed');
const Analytics = require('../models/Analytics');
const Post = require('../models/Post');
const { sendMulticast } = require('../utils/firebase');
const webpush = require('../utils/webpush');


let _io;
function setIo(io) { _io = io; }

async function initPostSubscriber() {
    await subscribe('posts.created', async (data) => {
        console.log('[NATS] Received posts.created event:');
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

        // Fetch followers' notification settings and tokens in bulk
        const followersData = await User.find({
            _id: { $in: followerIds },
            'notificationSettings.postNotifications': { $ne: false } // Only those who haven't disabled post notifications
        }).select('_id fcmToken webPushSubscription notificationSettings.pushEnabled').lean();

        // 1. Save notifications to DB (for all followers, so they see it in the app's notification list)
        const notifications = followerIds.map(followerId => ({
            recipient: followerId,
            sender: { id: author._id, fullname: author.fullname, profile_picture: author.profile_picture },
            type: 'new_post',
            post: postId,
        }));
        const savedNotifications = await Notification.insertMany(notifications);
        console.log(`[NATS] Notifications saved for ${followerIds.length} followers`);

        // 2. Dispatch Bulk Push Notifications (FCM & Web Push)
        const fcmTokens = [];
        const webSubscriptions = [];

        followersData.forEach(f => {
            if (f.notificationSettings?.pushEnabled !== false) {
                if (f.fcmToken) fcmTokens.push(f.fcmToken);
                if (f.webPushSubscription && process.env.VAPID_PUBLIC_KEY) webSubscriptions.push(f.webPushSubscription);
            }
        });

        const title = 'Social Square';
        const body = `${author.fullname} shared a new post`;

        if (fcmTokens.length > 0) {
            await sendMulticast(fcmTokens, {
                title,
                body,
                data: { type: 'new_post', postId: postId.toString() }
            });
            console.log(`[NATS] Dispatched bulk FCM push to ${fcmTokens.length} devices.`);
        }

        if (webSubscriptions.length > 0) {
            const webPayload = JSON.stringify({
                title,
                body,
                icon: '/logo.jpg',
                badge: '/logo.jpg',
                tag: 'new_post',
                data: { type: 'new_post', postId: postId.toString(), url: `/post/${postId}` }
            });

            const webPushPromises = webSubscriptions.map(sub => 
                webpush.sendNotification(sub, webPayload).catch(() => null)
            );
            await Promise.all(webPushPromises);
            console.log(`[NATS] Dispatched bulk Web Push to ${webSubscriptions.length} browsers.`);
        }

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