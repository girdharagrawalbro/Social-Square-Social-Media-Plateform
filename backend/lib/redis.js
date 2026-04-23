const IORedis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const isDisabled = process.env.DISABLE_REDIS === 'true';

let redis;

if (isDisabled) {
    console.log('[Redis] Disabled via DISABLE_REDIS flag');
    // Minimal mock to enable socket functionality (online status, typing) in single-instance mode
    const inMemoryData = {};
    redis = {
        hset: async (key, field, value) => {
            if (!inMemoryData[key]) inMemoryData[key] = {};
            inMemoryData[key][field] = value;
        },
        hget: async (key, field) => {
            return inMemoryData[key]?.[field] || null;
        },
        hdel: async (key, field) => {
            if (inMemoryData[key]) delete inMemoryData[key][field];
        },
        hgetall: async (key) => {
            return inMemoryData[key] || {};
        },
        get: async (key) => inMemoryData[key] || null,
        set: async (key, value) => { inMemoryData[key] = value; },
        del: async (...keys) => {
            const flatKeys = Array.isArray(keys[0]) ? keys[0] : keys;
            flatKeys.forEach(k => {
                if (k.endsWith('*')) {
                    const prefix = k.slice(0, -1);
                    Object.keys(inMemoryData).forEach(key => {
                        if (key.startsWith(prefix)) delete inMemoryData[key];
                    });
                } else {
                    delete inMemoryData[k];
                }
            });
        },
        on: () => { },
        quit: async () => { },
        status: 'disabled',
        duplicate: function () { return this; },
        connect: async () => { },
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