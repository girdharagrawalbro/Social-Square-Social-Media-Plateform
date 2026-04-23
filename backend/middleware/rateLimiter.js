const { RateLimiterRedis } = require('rate-limiter-flexible');
const redisClient = require('../lib/redis'); 

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  points: 100,
  duration: 60,
  keyPrefix: 'rl-main', // Shared prefix for rate limiting
});
module.exports = (req,res,next) => {
  if (redisClient.status === 'disabled') return next();
  const key = req.ip; // or use `req.user.id` for authenticated limits
  rateLimiter.consume(key)
    .then(() => next())
    .catch(() => res.status(429).json({ error: 'Too many requests' }));
};