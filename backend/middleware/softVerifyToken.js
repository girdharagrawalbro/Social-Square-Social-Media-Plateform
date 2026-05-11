const { hashValue } = require('../utils/authSecurity');
const LoginSession = require('../models/LoginSession');

/**
 * softVerifyToken middleware
 * 
 * Attempts to resolve the user identity from the Bearer token, but DOES NOT 
 * block the request if the token is missing or invalid.
 * Used for routes that have different behavior for guests vs. authenticated users 
 * (like public profiles or post feeds).
 */
async function softVerifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.userId = null;
        return next();
    }

    const token = authHeader.split(' ')[1];
    try {
        // FAST PATH: Decode JWT to get userId immediately without DB lookup
        // This helps resolve Race 1 where owner identity is needed before session verification completes
        try {
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            req.userId = payload.userId || payload.id || null;
        } catch (decodeErr) {
            req.userId = null;
        }

        const hashedToken = hashValue(token);
        // Use lean() for performance
        const session = await LoginSession.findOne({ 
            accessToken: hashedToken,
            isRevoked: false,
            expiresAt: { $gt: new Date() }
        }).select('userId').lean();
        
        // Final source of truth is the verified session
        if (session) {
            req.userId = session.userId;
        } else {
            // If session is invalid, revert userId to null to treat as guest
            req.userId = null;
        }
        next();
    } catch (err) {
        req.userId = null;
        next();
    }
}

module.exports = softVerifyToken;
