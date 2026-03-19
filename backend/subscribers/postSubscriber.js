const { subscribe } = require('../lib/nats');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Feed = require('../models/Feed');
const Analytics = require('../models/Analytics');

let _io;
function setIo(io) { _io = io; }

async function initPostSubscriber() {
    await subscribe('posts.created', async (data) => {
        console.log('[NATS] Received posts.created event:', data);
        const { id: postId, user, category } = data;

        const author = await User.findById(user._id).select('followers fullname profile_picture');
        console.log('[NATS] Author found:', author);
        console.log('[NATS] Followers:', author?.followers);

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

        // 2. Emit real-time socket event to each follower's room
        if (_io) {
            savedNotifications.forEach((notification) => {
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