const { RateLimiterMemory, RateLimiterRedis } = require('rate-limiter-flexible');
const redisClient = require('../lib/redis'); 

let rateLimiter;

// Initialize the primary Redis-backed limiter if URL is available AND not disabled
if (process.env.REDIS_URL && redisClient.status !== 'disabled') {
  rateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    points: 10,
    duration: 60,
    keyPrefix: 'rl-auth',
  });
}

// Memory-backed limiter for fallback
const memoryLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60,
});

module.exports = async (req, res, next) => {
  const key = req.ip;

  // 1. If no Redis or disabled, just use memory limiter and proceed
  if (redisClient.status === 'disabled' || !rateLimiter) {
    return memoryLimiter.consume(key)
      .then(() => next())
      .catch(() => res.status(429).json({ error: 'Too many login attempts. Please try again later.' }));
  }

  // 2. Try Redis limiter, fallback to Memory on Redis server error
  try {
    await rateLimiter.consume(key);
    next();
  } catch (err) {
    // Check if it's a rate limit rejection (no 'message' field usually) or a Redis Error
    if (err && err.consumePoints !== undefined) {
      // It's a rate limit rejection!
      return res.status(429).json({ error: 'Too many login/signup attempts. Please try again later.' });
    }

    // It's a Redis internal error (e.g., Upstash limit reached)
    console.warn('[RateLimiter] Redis error (limit reached?), falling back to Memory:', err?.message || 'Unknown error');
    
    try {
      await memoryLimiter.consume(key);
      next();
    } catch (memErr) {
      res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
    }
  }
};
