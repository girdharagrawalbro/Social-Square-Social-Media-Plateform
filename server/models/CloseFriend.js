const mongoose = require('mongoose');

const closeFriendSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    friendId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

closeFriendSchema.index({ userId: 1, friendId: 1 }, { unique: true });

module.exports = mongoose.model('CloseFriend', closeFriendSchema);
