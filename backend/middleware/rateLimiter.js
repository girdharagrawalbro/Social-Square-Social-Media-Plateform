const { RateLimiterRedis } = require('rate-limiter-flexible');
const Redis = require('ioredis');
const redisClient = new Redis(process.env.REDIS_URL);
const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  points: 100, duration: 60, keyPrefix: 'rl'
});
module.exports = (req,res,next) => {
  const key = req.ip; // or use `req.user.id` for authenticated limits
  rateLimiter.consume(key)
    .then(() => next())
    .catch(() => res.status(429).json({ error: 'Too many requests' }));
};