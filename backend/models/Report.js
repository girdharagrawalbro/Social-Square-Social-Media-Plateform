const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['post', 'user', 'comment'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    reason: {
        type: String,
        enum: ['spam', 'harassment', 'hate_speech', 'misinformation', 'nudity', 'violence', 'other'],
        required: true,
    },
    description: { type: String, default: null },
    status: { type: String, enum: ['pending', 'reviewed', 'resolved', 'dismissed'], default: 'pending' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Report', ReportSchema);