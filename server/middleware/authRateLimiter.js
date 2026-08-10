const { RateLimiterMemory, RateLimiterRedis } = require('rate-limiter-flexible');
const redisClient = require('../lib/redis');

let rateLimiter;

const limitPoints = Number(process.env.AUTH_RATE_LIMIT_POINTS) || 5000;
const limitDuration = Number(process.env.AUTH_RATE_LIMIT_DURATION) || 60;
const isRateLimitDisabled = process.env.DISABLE_RATE_LIMIT === 'true';

// Initialize the primary Redis-backed limiter if URL is available AND not disabled
if (process.env.REDIS_URL && redisClient.status !== 'disabled') {
  rateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    points: limitPoints,
    duration: limitDuration,
    keyPrefix: 'rl-auth',
  });
}

// Memory-backed limiter for fallback
const memoryLimiter = new RateLimiterMemory({
  points: limitPoints,
  duration: limitDuration,
});

module.exports = async (req, res, next) => {
  if (isRateLimitDisabled) return next();

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
    if (err && err.consumedPoints !== undefined) {
      // It's a rate limit rejection!
      return res.status(429).json({ error: 'Too many login/signup attempts. Please try again later.' });
    }

    // It's a Redis internal error (e.g., connection drop)
    console.warn('[RateLimiter] Redis connection issue, falling back to Memory:', err?.message || 'Unknown error');

    try {
      await memoryLimiter.consume(key);
      next();
    } catch (memErr) {
      res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
    }
  }
};
