const Notification = require('../models/Notification');
const User = require('../models/User');

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
const createNotification = async ({ recipientId, sender, type, postId, message, url, thumbnail }) => {
  try {
    // 🛡️ Null Guard: Ensure required identity fields exist (allow system and announcement notifications without a sender)
    if (!recipientId || ((type !== 'system' && type !== 'announcement') && (!sender || !sender.id))) {
      console.warn('[Notification] Skipped: Missing identity data', { recipientId, senderId: sender?.id });
      return null;
    }

    const finalSender = sender || {
      id: '000000000000000000000000',
      fullname: 'System',
      profile_picture: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    };

    // 🛡️ Safety Guard: Don't notify deleted users
    const recipient = await User.findById(recipientId).select('deletedAt fcmToken notificationSettings').lean();
    if (!recipient || recipient.deletedAt) {
      console.warn('[Notification] Skipped: Recipient is deleted or does not exist', { recipientId });
      return null;
    }

    // Don't notify yourself (unless it's a system/announcement notification like login alert)
    if (recipientId.toString() === finalSender.id.toString() && type !== 'system' && type !== 'announcement') {
      return null;
    }

    // Determine type categories
    const isLoginAlert = type === 'system' && (message?.content?.includes('Login') || message?.content?.includes('login') || message?.content?.includes('Password') || message?.content?.includes('OTP') || message?.content?.includes('Secure'));
    const isChat = type === 'message';
    const isPostRelated = ['like', 'comment', 'new_post', 'mention'].includes(type);
    const isUserRelated = ['follow', 'follow_request'].includes(type);

    const postEnabled = recipient?.notificationSettings?.postNotifications !== false;
    const userEnabled = recipient?.notificationSettings?.userNotifications !== false;

    // Check if we should skip creating the database record entirely
    if (!isLoginAlert && !isChat) {
      if (isPostRelated && !postEnabled) {
        return null; // Don't create DB record at all for disabled post notifications
      }
      // Note: for user notifications (follows/requests), we still save to DB so they "always be shown in request list".
    }

    const notification = await Notification.create({
      recipient: recipientId,
      sender: {
        id: finalSender.id,
        fullname: finalSender.fullname || 'System',
        profile_picture: finalSender.profile_picture || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
      },
      type,
      post: postId || null,
      message: message || null,
      url: url || null,
      thumbnail: thumbnail || null,
    });

    // 1. Emit real-time notification via Socket.io (Foreground)
    let shouldEmitSocket = false;
    if (isLoginAlert || isChat) {
      shouldEmitSocket = true;
    } else {
      if (isPostRelated && postEnabled) {
        shouldEmitSocket = true;
      } else if (isUserRelated && userEnabled) {
        shouldEmitSocket = true;
      } else if (!isPostRelated && !isUserRelated) {
        shouldEmitSocket = true;
      }
    }

    if (io && shouldEmitSocket) {
      io.to(recipientId.toString()).emit('newNotification', notification);
      if (type === 'mention') {
        io.to(recipientId.toString()).emit('newMention', {
          postId: postId || null,
          senderName: finalSender.fullname,
          url: url || null
        });
      }
    }

    // 2. Send Push Notification via Firebase (Background/Foreground)
    try {
      const { sendPushNotification } = require('../utils/firebase');

      if (recipient?.fcmToken) {
        const pushEnabled = recipient?.notificationSettings?.pushEnabled !== false;
        let shouldSendPush = false;

        if (isLoginAlert || isChat) {
          shouldSendPush = true; // Always send login alerts and chat notifications
        } else if (pushEnabled) {
          if (isPostRelated && postEnabled) {
            shouldSendPush = true;
          } else if (isUserRelated && userEnabled) {
            shouldSendPush = true;
          } else if (!isPostRelated && !isUserRelated) {
            shouldSendPush = true;
          }
        }

        if (shouldSendPush) {
          let title = 'Social Square';
          let body = '';

          switch (type) {
            case 'like': body = `${finalSender.fullname} liked your post`; break;
            case 'comment': body = `${finalSender.fullname} commented: "${message?.content?.substring(0, 30) || '...'}"`; break;
            case 'mention': body = `${finalSender.fullname} mentioned you: "${message?.content?.substring(0, 30) || '...'}"`; break;
            case 'follow': body = `${finalSender.fullname} started following you`; break;
            case 'message': body = `New message from ${finalSender.fullname}`; title = 'Social Square Chat'; break;
            case 'new_post': body = `${finalSender.fullname} shared a new post`; break;
            case 'system': body = message?.content || 'New system update'; break;
            case 'announcement': body = message?.content || 'New announcement'; title = 'Social Square Announcement'; break;
            default: body = `${finalSender.fullname} sent you a notification`;
          }

          await sendPushNotification(recipient.fcmToken, {
            title,
            body,
            data: {
              type,
              postId: postId ? postId.toString() : '',
              notificationId: notification._id.toString()
            }
          });
        }
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
