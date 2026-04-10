const Pusher = require('pusher');
const PusherClient = require('pusher-js').Pusher;

// Pusher Server (for publishing)
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

// Pusher Client (for subscribing inside Node.js)
let pusherClient;

async function initPubSub() {
    if (!pusherClient) {
        pusherClient = new PusherClient(process.env.PUSHER_KEY, {
            cluster: process.env.PUSHER_CLUSTER,
        });
        console.log('[Pusher] Client initialized for subscriptions');
    }
    return pusher;
}

async function publish(channel, data) {
    try {
        // Trigger event 'internal-event' on the channel
        await pusher.trigger(channel, 'internal-event', data);
        // console.log(`[Pusher] Published to ${channel}`);
    } catch (err) {
        console.error(`[Pusher] Publish error on ${channel}:`, err.message);
    }
}

async function subscribe(channel, handler) {
    try {
        await initPubSub();
        const chan = pusherClient.subscribe(channel);
        chan.bind('internal-event', (data) => {
            try {
                handler(data);
            } catch (err) {
                console.error(`[Pusher] Handling error on ${channel}:`, err.message);
            }
        });
        console.log(`[Pusher] Subscribed to channel: ${channel}`);
    } catch (err) {
        console.error(`[Pusher] Subscribe error on ${channel}:`, err.message);
    }
}

module.exports = { initPubSub, publish, subscribe };
