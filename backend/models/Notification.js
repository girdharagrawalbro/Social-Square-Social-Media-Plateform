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
    enum: ['like', 'comment', 'follow', 'follow_request', 'follow_accept', 'follow_decline', 'message', 'system', 'new_post'],  // added follow_accept/decline
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

module.exports = mongoose.model('Notification', notificationSchema);