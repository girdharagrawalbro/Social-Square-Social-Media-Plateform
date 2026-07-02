const mongoose = require('mongoose');

const MailLogSchema = new mongoose.Schema({
    to: { type: String, required: true },
    from: { type: String },
    subject: { type: String, required: true },
    html: { type: String },
    text: { type: String },
    status: { type: String, enum: ['sent', 'failed'], default: 'sent' },
    error: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('MailLog', MailLogSchema);
