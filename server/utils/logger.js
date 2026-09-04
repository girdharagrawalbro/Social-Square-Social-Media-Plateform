const winston = require('winston');
const { getRequestId } = require('../middleware/correlation');

const logFormat = winston.format.printf(({ level, message, timestamp, stack, requestId }) => {
    const idStr = requestId ? ` [${requestId}]` : '';
    return `${timestamp}${idStr} ${level.toUpperCase()}: ${stack || message}`;
});

const addRequestId = winston.format((info) => {
    const requestId = getRequestId();
    if (requestId) info.requestId = requestId;
    return info;
});

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        addRequestId(),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'social-square-backend' },
    transports: [
        new winston.transports.Console({
            format: process.env.NODE_ENV === 'production'
                ? winston.format.json()
                : winston.format.combine(
                    winston.format.timestamp({ format: 'HH:mm:ss' }),
                    winston.format.colorize(),
                    logFormat
                ),
        }),
    ],
});

logger.stream = {
    write: (message) => logger.info(message.trim()),
};

module.exports = logger;
