const eventBus = require('../lib/eventBus');
const { getRequestId } = require('../middleware/correlation');

async function publishEvent(subject, payload) {
    try {
        const requestId = getRequestId();
        const fullPayload = requestId ? { ...payload, requestId } : payload;
        
        // Emit to local EventBus for immediate in-memory consumption
        eventBus.emit(subject, fullPayload);

        // Also support wildcard listening by emitting a generic activity event
        if (subject.startsWith('user.activity.')) {
            eventBus.emit('user.activity.*', subject, fullPayload);
        }
    } catch (err) {
        console.error("❌ EventBus publish error:", err.message);
    }
}

module.exports = { publishEvent };