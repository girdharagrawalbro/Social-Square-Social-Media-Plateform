const mongoose = require('mongoose');

const ContentFilterSchema = new mongoose.Schema({
    word: { type: String, required: true, unique: true },
    action: { type: String, default: 'flag' },
}, { timestamps: true });

module.exports = mongoose.model('ContentFilter', ContentFilterSchema);
