const { connect, StringCodec } = require("nats");

let nc = null;
const sc = StringCodec();

async function initNatsPublisher() {
    if (nc) return nc;

    nc = await connect({
        servers: process.env.NATS_URL || "nats://nats.railway.internal:4222",
    });

    console.log("✅ NATS publisher connected");
    return nc;
}

const { getRequestId } = require('../middleware/correlation');

async function publishEvent(subject, payload) {
    try {
        const conn = await initNatsPublisher();
        const requestId = getRequestId();
        const fullPayload = requestId ? { ...payload, requestId } : payload;
        conn.publish(subject, sc.encode(JSON.stringify(fullPayload)));
        // console.log(`📤 Published to ${subject}`, fullPayload);
    } catch (err) {
        console.error("❌ NATS publish error:", err.message);
    }
}

module.exports = { publishEvent };