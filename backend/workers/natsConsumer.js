const { subscribe } = require('../lib/pubsub');

// Note: imageQueue was referenced in the original NATS worker but is not found in the project.
// This worker is updated to use Redis Pub/Sub and can be used for future background tasks.
async function run() {
  await subscribe('posts.created', async (data) => {
    try {
      console.log('[PubSub Worker] Received posts.created event for post:', data.id);
      // For example, trigger image processing or other background tasks here
      // await imageQueue.add('processImage', { postId: data.id });
    } catch (err) {
      console.error('[PubSub Worker] Error handling message:', err.message);
    }
  });
}

run().catch(console.error);