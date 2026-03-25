const { RateLimiterRedis } = require('rate-limiter-flexible');
const redisClient = require('../lib/redis'); 

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  points: 10, // 10 requests
  duration: 60, // per 60 seconds by IP
  keyPrefix: 'rl-auth', // specific prefix for auth endpoints
});

module.exports = (req, res, next) => {
  const key = req.ip;
  rateLimiter.consume(key)
    .then(() => next())
    .catch(() => res.status(429).json({ error: 'Too many login/signup attempts. Please try again later.' }));
};
