const mongoose = require('mongoose');

const ConversationKeySchema = new mongoose.Schema({
  conversationId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Conversation', 
    required: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  encryptedKey: { 
    type: String, 
    required: true 
  }, // Conversation AES key encrypted with the User's RSA-OAEP public key
}, { timestamps: true });

ConversationKeySchema.index({ conversationId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('ConversationKey', ConversationKeySchema);
