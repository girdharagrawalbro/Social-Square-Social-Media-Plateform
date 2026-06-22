const mongoose = require('mongoose');

const AccountabilityCheckInSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  weekStarting: { type: Date, required: true, index: true },
  wipText: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed', 'missed'], default: 'pending' },
  feedback: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('AccountabilityCheckIn', AccountabilityCheckInSchema);
