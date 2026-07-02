const mongoose = require('mongoose');

const EmailTemplateSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true }, // e.g., 'welcome_email', 'otp_email'
    name: { type: String, required: true }, // Human readable, e.g., 'Welcome Email'
    subject: { type: String, required: true },
    html: { type: String, required: true },
    variables: [{ type: String }] // e.g., ['{{fullname}}', '{{client_url}}'] for UI hints
}, { timestamps: true });

module.exports = mongoose.model('EmailTemplate', EmailTemplateSchema);
