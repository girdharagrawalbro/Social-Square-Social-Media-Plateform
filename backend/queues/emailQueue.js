const { Queue, Worker } = require('bullmq');
const redis = require('../lib/redis'); 

const isRedisDisabled = process.env.DISABLE_REDIS === 'true';

// BullMQ can use the existing ioredis instance directly
const emailQueue = !isRedisDisabled ? new Queue('email', { connection: redis }) : null;

// Worker (run in separate process/container)
if (require.main === module && !isRedisDisabled) {
  const w = new Worker('email', async job => {
    // job processing
    console.log('Processing email job', job.id, job.name, job.data);
  }, { connection: redis, concurrency: 2, limiter: { max: 5, duration: 1000 } });
}

module.exports = { emailQueue };