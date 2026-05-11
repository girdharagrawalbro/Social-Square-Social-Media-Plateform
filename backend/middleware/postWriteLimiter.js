const rateLimit = require('express-rate-limit');

const postWriteLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 attempts per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many write attempts. Please wait a minute.' },
    keyGenerator: (req) => req.userId || req.ip, // Rate limit by user ID if authenticated
});

module.exports = postWriteLimiter;
