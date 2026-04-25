const { hashValue } = require('../utils/authSecurity');
const LoginSession = require('../models/LoginSession');

async function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized. No token provided.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const hashedToken = hashValue(token);
        const session = await LoginSession.findOne({ accessToken: hashedToken });
        
        if (!session) {
            return res.status(401).json({ message: 'Unauthorized. Session not found.' });
        }
        
        if (session.isRevoked) {
            return res.status(401).json({ message: 'Unauthorized. Session revoked.' });
        }
        
        if (session.expiresAt < new Date()) {
            return res.status(401).json({ message: 'Unauthorized. Session expired.' });
        }

        // Update sliding window TTL safely
        await LoginSession.updateOne(
            { _id: session._id },
            { 
                $set: { 
                    lastUsedAt: new Date(), 
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) 
                } 
            }
        );

        req.userId = session.userId;
        req.family = session.tokenFamily;
        next();
    } catch (err) {
        console.error('Token verification error:', err);
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
}

module.exports = verifyToken;