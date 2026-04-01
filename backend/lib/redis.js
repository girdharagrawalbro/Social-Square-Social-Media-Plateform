const IORedis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new IORedis(redisUrl, {
    maxRetriesPerRequest: null, // Critical for BullMQ
    retryStrategy: (times) => Math.min(times * 50, 2000),
});

console.log(`[Redis] Initialized with URL: ${redisUrl.split('@')[1] || '(local)'} (PID: ${process.pid})`);

redis.getRedis = () => redis;
redis.redis = redis;

module.exports = redis;