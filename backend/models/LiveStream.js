const mongoose = require('mongoose');

const LiveStreamSchema = new mongoose.Schema({
    host: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'ended'],
        default: 'active'
    },
    viewers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: {
        type: Date
    },
    title: {
        type: String,
        default: 'Live Stream'
    }
}, { timestamps: true });

module.exports = mongoose.model('LiveStream', LiveStreamSchema);
