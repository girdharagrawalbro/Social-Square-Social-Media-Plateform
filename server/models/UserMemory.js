const mongoose = require('mongoose');

const userMemorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    facts: [{
        type: String,
        trim: true
    }],
    lastExtractedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('UserMemory', userMemorySchema);
