const mongoose = require('mongoose');

const SystemSettingSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    description: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('SystemSetting', SystemSettingSchema);
