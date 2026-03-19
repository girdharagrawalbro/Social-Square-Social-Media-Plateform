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
    enum: ['like', 'comment', 'follow', 'message', 'system', 'new_post'],  // added new_post
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
  url: { type: String, required: false },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Notification', notificationSchema);