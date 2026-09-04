const mongoose = require('mongoose');
const logger = require('./utils/logger');

// Throttled slow query logging: at most 1 warning per 60s
let lastSlowQueryLog = 0;
mongoose.plugin((schema) => {
    schema.pre(['find', 'findOne', 'aggregate'], function () {
        this._startTime = Date.now();
    });
    schema.post(['find', 'findOne', 'aggregate'], function () {
        const duration = Date.now() - (this._startTime || Date.now());
        if (duration > 1000) {
            const now = Date.now();
            if (now - lastSlowQueryLog > 60000) {
                lastSlowQueryLog = now;
                logger.warn(`[SlowQuery] ${this.mongooseCollection?.name || 'unknown'} took ${duration}ms`);
            }
        }
    });
});

const connectToMongo = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            maxPoolSize: 30,
            minPoolSize: 2,
            maxIdleTimeMS: 10000,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 5000,
            retryWrites: true,
            retryReads: true,
        });
        logger.info(`[MongoDB] Connected (PID: ${process.pid})`); ``
    } catch (err) {
        logger.error('[MongoDB] Connection failed:', err.message);
        setTimeout(connectToMongo, 5000);
    }
};

mongoose.connection.on('disconnected', () => {
    logger.warn('[MongoDB] Disconnected — reconnecting...');
    setTimeout(connectToMongo, 3000);
});

mongoose.connection.on('error', (err) => logger.error('[MongoDB] Error:', err.message));

module.exports = connectToMongo;