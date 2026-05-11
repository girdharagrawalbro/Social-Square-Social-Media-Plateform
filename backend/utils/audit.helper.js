const AuditLog = require('../models/AuditLog');

/**
 * @param {object} opts
 * @param {string}  opts.adminId       - req.user._id
 * @param {string}  opts.action        - one of the enum values in the model
 * @param {string}  opts.targetType    - 'user' | 'post' | 'comment' | 'report' | 'system'
 * @param {string}  [opts.targetId]    - ObjectId of the affected record
 * @param {object}  [opts.snapshot]    - { name, email, picture } — capture before deletion
 * @param {object}  [opts.meta]        - { reason, ip }
 */
async function logAdminAction({ adminId, action, targetType, targetId, snapshot = {}, meta = {} }) {
    try {
        await AuditLog.create({
            admin: adminId || null,
            action,
            targetType,
            targetId: targetId || null,
            targetSnapshot: snapshot,
            meta,
        });
    } catch (err) {
        console.error('[AuditLog] Failed to write log:', err.message);
    }
}

module.exports = { logAdminAction };
