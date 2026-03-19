const IORedis = require('ioredis');
const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');
module.exports = redis;