const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: [{
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
    },],

    lastMessage: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
        default: null,
      },
      message: {
        type: String,
        default: '',
      },
      isRead: {
        type: Boolean,
        default: false,
      }
    },
    lastMessageBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastMessageAt: {
      type: Date, // Timestamp for the last message
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Conversation', conversationSchema);

