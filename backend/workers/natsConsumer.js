const { initNats } = require('../lib/nats');
const { imageQueue } = require('../queues/imageQueue'); // or other queues

async function run() {
  const { js, sc } = await initNats();
  const sub = await js.subscribe('posts.created', { durable: 'posts_consumer' });
  (async () => {
    for await (const m of sub) {
      const data = JSON.parse(sc.decode(m.data));
      await imageQueue.add('processImage', { postId: data.id });
      m.ack();
    }
  })();
}
run().catch(console.error);