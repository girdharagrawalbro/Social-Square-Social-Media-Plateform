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

async function publishEvent(subject, payload) {
    try {
        const conn = await initNatsPublisher();
        conn.publish(subject, sc.encode(JSON.stringify(payload)));
        console.log(`📤 Published to ${subject}`, payload);
    } catch (err) {
        console.error("❌ NATS publish error:", err.message);
    }
}

module.exports = { publishEvent };