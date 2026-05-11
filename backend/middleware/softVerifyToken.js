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
        const hashedToken = hashValue(token);
        // Use lean() for performance as we only need the userId
        const session = await LoginSession.findOne({ 
            accessToken: hashedToken,
            isRevoked: false,
            expiresAt: { $gt: new Date() }
        }).select('userId').lean();
        
        req.userId = session ? session.userId : null;
        next();
    } catch (err) {
        // Silently fail auth and treat as guest
        req.userId = null;
        next();
    }
}

module.exports = softVerifyToken;
