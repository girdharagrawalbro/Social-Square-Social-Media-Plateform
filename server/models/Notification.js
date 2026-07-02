const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sender: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fullname: { type: String, required: true },
    profile_picture: { type: String },
  },
  type: {
    type: String,
    enum: ['like', 'comment', 'follow', 'follow_request', 'follow_accept', 'follow_decline', 'message', 'system', 'new_post', 'announcement', 'mention'],  // added follow_accept/decline and mention
    default: 'message'
  },
  // Optional — only for message notifications
  message: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', required: false },  // was required: true
    content: { type: String, required: false },                                      // was required: true
  },
  // Optional — only for post notifications
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    default: null,
  },
  thumbnail: { type: String, required: false },
  url: { type: String, required: false },
  read: { type: Boolean, default: false },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

notificationSchema.index({ recipient: 1, createdAt: -1 }); // Notifications list
notificationSchema.index({ recipient: 1, read: 1 });        // Unread count + cleanup
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // TTL: 90 days

module.exports = mongoose.model('Notification', notificationSchema);