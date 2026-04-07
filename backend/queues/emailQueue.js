const { Queue, Worker } = require('bullmq');
const redis = require('../lib/redis'); 

// BullMQ can use the existing ioredis instance directly
const emailQueue = new Queue('email', { connection: redis });


// Worker (run in separate process/container)
if (require.main === module) {
  const w = new Worker('email', async job => {
    // job processing
    console.log('Processing email job', job.id, job.name, job.data);
  }, { connection: redis, concurrency: 2, limiter: { max: 5, duration: 1000 } });
}
module.exports = { emailQueue };