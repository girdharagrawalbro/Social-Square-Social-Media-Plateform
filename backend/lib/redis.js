const IORedis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const isDisabled = process.env.DISABLE_REDIS === 'true';

let redis;

if (isDisabled) {
    console.log('[Redis] Disabled via DISABLE_REDIS flag');
    // Minimal mock to prevent crashes, though features like online status will be limited
    redis = {
        hset: async () => {},
        hget: async () => null,
        hdel: async () => {},
        hgetall: async () => ({}),
        get: async () => null,
        set: async () => {},
        on: () => {},
        quit: async () => {},
        status: 'disabled',
        duplicate: function() { return this; },
        connect: async () => {},
    };
} else {
    redis = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        retryStrategy: (times) => {
            const MAX_ATTEMPTS = 5;
            if (times > MAX_ATTEMPTS) {
                console.error('[Redis] Max retry attempts reached. Connection failed.');
                return null; 
            }
            return Math.min(times * 50, 2000);
        },
    });

    redis.on('error', (err) => {
        if (err.message.includes('Limit reached') || err.message.includes('quota')) {
            console.error('[Redis] CRITICAL: Upstash limit reached! Please set DISABLE_REDIS=true in your environment.');
        } else {
            console.error('[Redis] Error:', err.message);
        }
    });

    console.log(`[Redis] Initialized with URL: ${redisUrl.split('@')[1] || '(local)'} (PID: ${process.pid})`);
}

redis.getRedis = () => redis;
redis.redis = redis;

module.exports = redis;