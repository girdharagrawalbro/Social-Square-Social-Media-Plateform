const IORedis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redis = new IORedis(redisUrl, {
    // BullMQ prefers commands to be queued during reconnects.
    // Keep `maxRetriesPerRequest: null` for BullMQ compatibility,
    // but stop reconnect attempts after a few tries to avoid storms.
    maxRetriesPerRequest: null,
    retryStrategy: (times) => {
        const MAX_ATTEMPTS = 5;
        if (times > MAX_ATTEMPTS) return null; // stop retrying after N attempts
        return Math.min(times * 50, 2000);
    },
});

console.log(`[Redis] Initialized with URL: ${redisUrl.split('@')[1] || '(local)'} (PID: ${process.pid})`);

redis.getRedis = () => redis;
redis.redis = redis;

module.exports = redis;