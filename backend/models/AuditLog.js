const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false, // making it false in case system actions don't have an admin user
    },
    action: {
        type: String,
        required: true,
        enum: [
            'ban_user',
            'unban_user',
            'delete_user',
            'delete_post',
            'delete_comment',
            'resolve_report',
            'dismiss_report',
            'trigger_digest',
            'warn_user',
            'content_flagged'
        ],
    },
    targetType: {
        type: String,
        enum: ['user', 'post', 'comment', 'report', 'system'],
        required: true,
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
    },
    targetSnapshot: {
        name: String,
        email: String,
        picture: String,
    },
    meta: {
        reason: String,
        ip: String,
    },
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ admin: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ targetType: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
