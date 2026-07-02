const axios = require('axios');
const { getRequestId } = require('../middleware/correlation');

/**
 * Axios instance that automatically propagates the x-request-id header
 */
const http = axios.create();

http.interceptors.request.use((config) => {
    const requestId = getRequestId();
    if (requestId) {
        config.headers['x-request-id'] = requestId;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

module.exports = http;
