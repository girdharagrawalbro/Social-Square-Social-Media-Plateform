const { Queue, QueueScheduler, Worker } = require('bullmq');
const Redis = require('../lib/redis'); // ioredis instance
const connection = { host: process.env.REDIS_HOST || '127.0.0.1', port: process.env.REDIS_PORT || 6379 };

const emailQueue = new Queue('email', { connection });


// Worker (run in separate process/container)
if (require.main === module) {
  const w = new Worker('email', async job => {
    // job processing
    console.log('Processing email job', job.id, job.name, job.data);
  }, { connection, concurrency: 5 });
}
module.exports = { emailQueue };