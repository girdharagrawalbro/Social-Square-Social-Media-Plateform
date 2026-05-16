const Notification = require('../models/Notification');

let io;

const setIo = (socketIoInstance) => {
  io = socketIoInstance;
};

/**
 * Create and send a notification
 * @param {Object} params
 * @param {String} params.recipientId - ID of the user receiving the notification
 * @param {Object} params.sender - { id, fullname, profile_picture }
 * @param {String} params.type - 'like', 'comment', 'follow', 'message', 'system', 'new_post'
 * @param {String} [params.postId] - Optional related post ID
 * @param {Object} [params.message] - { id, content }
 * @param {String} [params.url] - Optional link
 */
const createNotification = async ({ recipientId, sender, type, postId, message, url }) => {
  try {
    // 🛡️ Null Guard: Ensure required identity fields exist
    if (!recipientId || !sender || !sender.id) {
      console.warn('[Notification] Skipped: Missing identity data', { recipientId, senderId: sender?.id });
      return null;
    }

    // 🛡️ Safety Guard: Don't notify deleted users
    const User = require('../models/User');
    const recipient = await User.findById(recipientId).select('deletedAt').lean();
    if (!recipient || recipient.deletedAt) {
      console.warn('[Notification] Skipped: Recipient is deleted or does not exist', { recipientId });
      return null;
    }

    // Don't notify yourself (unless it's a system notification like login alert)
    if (recipientId.toString() === sender.id.toString() && type !== 'system') {
      return null;
    }

    const notification = await Notification.create({
      recipient: recipientId,
      sender: {
        id: sender.id,
        fullname: sender.fullname || 'Unknown User',
        profile_picture: sender.profile_picture || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
      },
      type,
      post: postId || null,
      message: message || null,
      url: url || null,
    });

    // 1. Emit real-time notification via Socket.io (Foreground)
    if (io) {
      io.to(recipientId.toString()).emit('newNotification', notification);
    }

    // 2. Send Push Notification via Firebase (Background/Foreground)
    try {
        const { sendPushNotification } = require('../utils/firebase');
        // Fetch recipient's FCM token
        const recipientWithToken = await User.findById(recipientId).select('fcmToken').lean();
        
        if (recipientWithToken?.fcmToken) {
            let title = 'Social Square';
            let body = '';

            switch (type) {
                case 'like': body = `${sender.fullname} liked your post`; break;
                case 'comment': body = `${sender.fullname} commented: "${message?.content?.substring(0, 30) || '...'}"`; break;
                case 'follow': body = `${sender.fullname} started following you`; break;
                case 'message': body = `New message from ${sender.fullname}`; title = 'Social Square Chat'; break;
                case 'new_post': body = `${sender.fullname} shared a new post`; break;
                case 'system': body = message?.content || 'New system update'; break;
                default: body = `${sender.fullname} sent you a notification`;
            }

            await sendPushNotification(recipientWithToken.fcmToken, {
                title,
                body,
                data: {
                    type,
                    postId: postId ? postId.toString() : '',
                    notificationId: notification._id.toString()
                }
            });
        }
    } catch (pushErr) {
        console.error('[Notification Push Error]', pushErr.message);
    }

    return notification;
  } catch (err) {
    console.error('[Notification Error]', err.message);
    return null;
  }
};

const deleteNotifications = async (filter) => {
  try {
    return await Notification.deleteMany(filter);
  } catch (err) {
    console.error('[Notification Delete Error]', err.message);
    return null;
  }
};

const updateNotifications = async (filter, updates) => {
  try {
    return await Notification.updateMany(filter, updates);
  } catch (err) {
    console.error('[Notification Update Error]', err.message);
    return null;
  }
};

module.exports = {
  setIo,
  createNotification,
  deleteNotifications,
  updateNotifications,
};
