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
    // Don't notify yourself (unless it's a system notification like login alert)
    if (recipientId.toString() === sender.id.toString() && type !== 'system') {
      return null;
    }

    const notification = await Notification.create({
      recipient: recipientId,
      sender: {
        id: sender.id,
        fullname: sender.fullname,
        profile_picture: sender.profile_picture,
      },
      type,
      post: postId || null,
      message: message || null,
      url: url || null,
    });

    // Emit real-time notification via Socket.io
    if (io) {
      io.to(recipientId.toString()).emit('newNotification', notification);
    }

    return notification;
  } catch (err) {
    console.error('[Notification Error]', err.message);
    return null;
  }
};

module.exports = {
  setIo,
  createNotification,
};
