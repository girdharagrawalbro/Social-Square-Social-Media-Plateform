const { RateLimiterMemory, RateLimiterRedis } = require('rate-limiter-flexible');
const redis = require('../lib/redis'); // Need to import redis

const createPostWriteLimiter = () => {
    let limiter;
    const maxPoints = process.env.NODE_ENV === 'production' ? 30 : 5000;
    if (process.env.DISABLE_REDIS === 'true' || !process.env.REDIS_URL || !redis) {
        limiter = new RateLimiterMemory({ points: maxPoints, duration: 3600 }); // 1 hour
    } else {
        limiter = new RateLimiterRedis({
            storeClient: redis,
            points: maxPoints,
            duration: 3600,
            keyPrefix: 'rl_post_write'
        });
    }

    return async (req, res, next) => {
        // Key by userId if authenticated, else IP
        const key = req.userId || req.ip;
        try {
            await limiter.consume(key);
            next();
        } catch (err) {
            res.status(429).json({ error: 'Too many post creation attempts. Please wait.' });
        }
    };
};

const postWriteLimiter = createPostWriteLimiter();

module.exports = postWriteLimiter;
