const Pusher = require('pusher');
const EventEmitter = require('events');

// Internal event bus for server-side pub/sub (replaces pusher-js browser client)
const internalBus = new EventEmitter();
internalBus.setMaxListeners(50);

// Pusher Server (for pushing real-time events to frontend clients)
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

async function initPubSub() {
    console.log('[PubSub] Internal EventEmitter bus ready');
    return pusher;
}

async function publish(channel, data) {
    try {
        // Notify internal server-side subscribers immediately
        internalBus.emit(channel, data);

        // Also push to frontend via Pusher
        await pusher.trigger(channel, 'internal-event', data);
        // console.log(`[Pusher] Published to ${channel}`);
    } catch (err) {
        console.error(`[Pusher] Publish error on ${channel}:`, err.message);
    }
}

async function subscribe(channel, handler) {
    try {
        internalBus.on(channel, async (data) => {
            try {
                await handler(data);
            } catch (err) {
                console.error(`[PubSub] Handling error on ${channel}:`, err.message);
            }
        });
        console.log(`[PubSub] Subscribed to channel: ${channel}`);
    } catch (err) {
        console.error(`[PubSub] Subscribe error on ${channel}:`, err.message);
    }
}

module.exports = { initPubSub, publish, subscribe };
