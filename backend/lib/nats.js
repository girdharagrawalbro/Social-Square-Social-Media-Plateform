const { connect, StringCodec } = require('nats');

let nc;
const sc = StringCodec();

async function initNats() {
    if (nc && !nc.isClosed()) return nc;
    nc = await connect({ servers: process.env.NATS_URL || 'nats://localhost:4222' });
    console.log('Connected to NATS successfully');
    return nc;
}

async function publish(subject, payload) {
    const conn = await initNats();
    conn.publish(subject, sc.encode(JSON.stringify(payload)));
}

async function subscribe(subject, handler) {
    const conn = await initNats();
    const sub = conn.subscribe(subject);
    (async () => {
        for await (const msg of sub) {
            try {
                const data = JSON.parse(sc.decode(msg.data));
                await handler(data);
            } catch (err) {
                console.error(`Error handling NATS message on [${subject}]:`, err.message);
            }
        }
    })();
    console.log(`Subscribed to NATS subject: ${subject}`);
}

module.exports = { initNats, publish, subscribe };