const messageSchema = new mongoose.Schema(
    {
      conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true,
      },
      sender: {
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
      content: {
        type: String,
        required: true,
      },
      isRead: {
        type: Boolean,
        default: false, // Track whether the message has been read
      },
    },
    { timestamps: true }
  );
  
  module.exports = mongoose.model('Message', messageSchema);
  