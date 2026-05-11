const crypto = require('crypto');
const UAParser = require('ua-parser-js');
const axios = require('axios');

// Hash a token or fingerprint before storing
function hashValue(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

// Generate a unique token family ID for a new login session
function generateFamily() {
    return crypto.randomBytes(32).toString('hex');
}

// Parse user agent into readable device string
function parseDevice(userAgent) {
    if (!userAgent) return 'Unknown Device';
    const parser = new UAParser(userAgent);
    const result = parser.getResult();
    const browser = result.browser.name || 'Unknown Browser';
    const os = result.os.name || 'Unknown OS';
    return `${browser} on ${os}`;
}

// Get geolocation from IP (free service, no API key needed)
async function getLocation(ip) {
    try {
        // Skip for localhost
        if (ip === '127.0.0.1' || ip === '::1' || ip?.startsWith('192.168')) {
            return { city: 'Localhost', region: 'Local', country: 'Local' };
        }
        const res = await axios.get(`http://ip-api.com/json/${ip}?fields=city,regionName,country`, { timeout: 3000 });
        return {
            city: res.data.city || 'Unknown',
            region: res.data.regionName || 'Unknown',
            country: res.data.country || 'Unknown',
        };
    } catch {
        return { city: 'Unknown', region: 'Unknown', country: 'Unknown' };
    }
}

// Extract real IP from request
function getIp(req) {
    return (
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.socket?.remoteAddress ||
        'Unknown'
    );
}

module.exports = { hashValue, generateFamily, parseDevice, getLocation, getIp };