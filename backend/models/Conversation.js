const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        fullname: {
          type: String,
          required: true,
        },
        profilePicture: {
          type: String,
          required: true,
        },
      },
    ],
    lastMessage: {
      type: String, // Store the last message text for quick preview
      default: '',
    },
    lastMessageAt: {
      type: Date, // Timestamp for the last message
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Conversation', conversationSchema);
