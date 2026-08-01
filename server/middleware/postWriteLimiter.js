const rateLimit = require('express-rate-limit');

const postWriteLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 200 : 5000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many write attempts. Please wait a minute.' },
    keyGenerator: (req) => req.userId || req.ip,
});

module.exports = postWriteLimiter;
