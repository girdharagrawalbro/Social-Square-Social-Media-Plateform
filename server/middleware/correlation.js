const { AsyncLocalStorage } = require('async_hooks');
const { v4: uuidv4 } = require('uuid');

const correlationContext = new AsyncLocalStorage();

/**
 * Middleware to manage x-request-id correlation
 */
const correlationMiddleware = (req, res, next) => {
    const requestId = req.headers['x-request-id'] || uuidv4();
    
    // Set response header so client can trace it too
    res.setHeader('x-request-id', requestId);
    
    // Run the rest of the request within the async storage context
    correlationContext.run(requestId, () => {
        next();
    });
};

/**
 * Get the current request ID from the async context
 */
const getRequestId = () => {
    return correlationContext.getStore();
};

module.exports = {
    correlationMiddleware,
    getRequestId
};
