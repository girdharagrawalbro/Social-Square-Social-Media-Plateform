const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Post = require('../models/Post');
const LoginSession = require('../models/LoginSession');
const { decryptPassword, isEncrypted } = require('../utils/crypto');
const { hashValue, generateFamily, parseDevice, getLocation, getIp } = require('../utils/authSecurity');
const { sendNewDeviceAlert, sendResetEmail, sendOtpEmail, sendLockoutEmail } = require('../utils/mailer');
const logger = require('../utils/logger');
const verifyToken = require('../middleware/Verifytoken');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

if (!JWT_SECRET || !JWT_REFRESH_SECRET) { console.error('Missing JWT secrets'); process.exit(1); }

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateAccessToken(userId) {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' });
}
function generateRefreshToken(userId, family) {
    return jwt.sign({ userId, family }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
}
function setRefreshTokenCookie(res, token) {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        // 'none' is required for cross-domain cookies in production (Vercel -> Backend)
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
}
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

// ─── Rate Limiters ────────────────────────────────────────────────────────────

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many attempts.' } });
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3, message: { error: 'Too many reset attempts.' } });
const otpLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 5, message: { error: 'Too many OTP attempts.' } });

// verifyToken middleware imported from ../middleware/Verifytoken

// ─── LOGIN ────────────────────────────────────────────────────────────────────

router.post('/login', authLimiter, [
    body('identifier').isEmail(),
    body('password').notEmpty(),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { identifier, password, fingerprint } = req.body;
        if (!fingerprint) return res.status(400).json({ error: 'Missing browser fingerprint' });

        const user = await User.findOne({ email: identifier.toLowerCase().trim() });
        if (!user || !user.password) return res.status(401).json({ error: 'Invalid email or password' });

        // ── LOCKOUT CHECK ──
        if (user.lockoutUntil && user.lockoutUntil > Date.now()) {
            const remaining = Math.ceil((user.lockoutUntil - Date.now()) / 60000);
            return res.status(423).json({ error: `Account locked. Try again in ${remaining} minute(s).` });
        }

        const decryptedPassword = isEncrypted(password) ? decryptPassword(password) : password;
        const isValid = await bcrypt.compare(decryptedPassword, user.password);

        if (!isValid) {
            // ── INCREMENT FAILED ATTEMPTS ──
            user.failedLoginAttempts += 1;
            if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
                user.lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
                user.failedLoginAttempts = 0;
                await user.save();
                const unlockTime = new Date(user.lockoutUntil).toLocaleTimeString();
                sendLockoutEmail(user.email, user.fullname, unlockTime).catch(() => { });
                return res.status(423).json({ error: 'Too many failed attempts. Account locked for 30 minutes.' });
            }
            await user.save();
            const attemptsLeft = MAX_FAILED_ATTEMPTS - user.failedLoginAttempts;
            return res.status(401).json({ error: `Invalid email or password. ${attemptsLeft} attempt(s) remaining.` });
        }

        // ── RESET FAILED ATTEMPTS ON SUCCESS ──
        user.failedLoginAttempts = 0;
        user.lockoutUntil = null;

        // ── 2FA CHECK ──
        if (user.twoFactorEnabled) {
            const otp = generateOtp();
            user.twoFactorOtp = hashValue(otp);
            user.twoFactorOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
            await user.save();
            await sendOtpEmail(user.email, user.fullname, otp);
            return res.status(200).json({ requiresOtp: true, userId: user._id });
        }

        await user.save();

        // ── SESSION CREATION ──
        const hashedFingerprint = hashValue(fingerprint);
        const existingSession = await LoginSession.findOne({ userId: user._id, fingerprint: hashedFingerprint, isRevoked: false });
        const isNewDevice = !existingSession;

        const family = generateFamily();
        const refreshToken = generateRefreshToken(user._id, family);
        const ip = getIp(req);
        const device = parseDevice(req.headers['user-agent']);
        const location = await getLocation(ip);

        await LoginSession.create({
            userId: user._id, tokenFamily: family,
            refreshToken: hashValue(refreshToken),
            fingerprint: hashedFingerprint,
            ip, userAgent: req.headers['user-agent'] || '',
            device, location, isNewDevice,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        if (isNewDevice) {
            sendNewDeviceAlert({ email: user.email, fullname: user.fullname, device, ip, location, time: new Date().toLocaleString() })
                .catch(err => console.warn('Alert email failed:', err.message));
        }

        const accessToken = generateAccessToken(user._id);
        setRefreshTokenCookie(res, refreshToken);

        // Return user object so frontend can restore session without extra request
        const userResponse = await User.findById(user._id)
            .select('-password -twoFactorOtp -resetPasswordToken -twoFactorOtpExpires')
            .lean();

        return res.status(200).json({ token: accessToken, user: userResponse });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── VERIFY OTP ───────────────────────────────────────────────────────────────

router.post('/verify-otp', otpLimiter, [
    body('userId').notEmpty(),
    body('otp').isLength({ min: 6, max: 6 }),
    body('fingerprint').notEmpty(),
], async (req, res) => {
    try {
        const { userId, otp, fingerprint } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (!user.twoFactorOtp || !user.twoFactorOtpExpires || user.twoFactorOtpExpires < Date.now()) {
            return res.status(400).json({ error: 'OTP expired. Please login again.' });
        }

        if (user.twoFactorOtp !== hashValue(otp)) {
            return res.status(401).json({ error: 'Invalid OTP.' });
        }

        // Clear OTP
        user.twoFactorOtp = null;
        user.twoFactorOtpExpires = null;
        await user.save();

        // Create session
        const hashedFingerprint = hashValue(fingerprint);
        const existingSession = await LoginSession.findOne({ userId: user._id, fingerprint: hashedFingerprint, isRevoked: false });
        const isNewDevice = !existingSession;

        const family = generateFamily();
        const refreshToken = generateRefreshToken(user._id, family);
        const ip = getIp(req);
        const device = parseDevice(req.headers['user-agent']);
        const location = await getLocation(ip);

        await LoginSession.create({
            userId: user._id, tokenFamily: family,
            refreshToken: hashValue(refreshToken),
            fingerprint: hashedFingerprint,
            ip, userAgent: req.headers['user-agent'] || '',
            device, location, isNewDevice,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        if (isNewDevice) {
            sendNewDeviceAlert({ email: user.email, fullname: user.fullname, device, ip, location, time: new Date().toLocaleString() })
                .catch(() => { });
        }

        const accessToken = generateAccessToken(user._id);
        setRefreshTokenCookie(res, refreshToken);

        // Return user object so frontend can restore session without extra request
        const userResponse = await User.findById(user._id)
            .select('-password -twoFactorOtp -resetPasswordToken -twoFactorOtpExpires')
            .lean();

        return res.status(200).json({ token: accessToken, user: userResponse });
    } catch (error) {
        console.error('OTP verify error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── TOGGLE 2FA ───────────────────────────────────────────────────────────────

router.post('/toggle-2fa', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });
        const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.twoFactorEnabled = !user.twoFactorEnabled;
        await user.save();
        return res.status(200).json({ twoFactorEnabled: user.twoFactorEnabled });
    } catch {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── SIGNUP ───────────────────────────────────────────────────────────────────

router.post('/add', authLimiter, [
    body('fullname').trim().isLength({ min: 2, max: 50 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { fullname, email, password, fingerprint } = req.body;
        if (!fingerprint) return res.status(400).json({ error: 'Missing browser fingerprint' });

        const decryptedPassword = isEncrypted(password) ? decryptPassword(password) : password;
        const existing = await User.findOne({ email: email.toLowerCase().trim() });
        if (existing) return res.status(400).json({ message: 'User already exists with this email.' });

        const hashedPassword = await bcrypt.hash(decryptedPassword, 12);
        const newUser = new User({ fullname: fullname.trim(), email: email.toLowerCase().trim(), password: hashedPassword, authProvider: 'local' });
        await newUser.save();

        const family = generateFamily();
        const refreshToken = generateRefreshToken(newUser._id, family);
        const ip = getIp(req);
        const device = parseDevice(req.headers['user-agent']);
        const location = await getLocation(ip);

        await LoginSession.create({
            userId: newUser._id, tokenFamily: family,
            refreshToken: hashValue(refreshToken),
            fingerprint: hashValue(fingerprint),
            ip, userAgent: req.headers['user-agent'] || '',
            device, location, isNewDevice: true,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        const accessToken = generateAccessToken(newUser._id);
        setRefreshTokenCookie(res, refreshToken);

        // Return user object so frontend can restore session without extra request
        const userResponse = await User.findById(newUser._id)
            .select('-password -twoFactorOtp -resetPasswordToken -twoFactorOtpExpires')
            .lean();

        return res.status(201).json({ token: accessToken, user: userResponse });
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ message: 'Failed to register user.' });
    }
});

// ─── GOOGLE OAUTH ─────────────────────────────────────────────────────────────

router.post('/google', authLimiter, async (req, res) => {
    try {
        const { credential, fingerprint } = req.body;
        if (!credential || !fingerprint) return res.status(400).json({ error: 'Missing credential or fingerprint' });

        const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
        const { sub: googleId, email, name, picture } = ticket.getPayload();

        let user = await User.findOne({ $or: [{ googleId }, { email }] });
        if (!user) {
            user = new User({ fullname: name, email, profile_picture: picture, googleId, authProvider: 'google' });
        } else {
            user.googleId = googleId;
            if (!user.profile_picture || user.profile_picture.includes('OIP')) user.profile_picture = picture;
        }
        await user.save();

        const hashedFingerprint = hashValue(fingerprint);
        const existingSession = await LoginSession.findOne({ userId: user._id, fingerprint: hashedFingerprint, isRevoked: false });
        const isNewDevice = !existingSession;
        const family = generateFamily();
        const refreshToken = generateRefreshToken(user._id, family);
        const ip = getIp(req);
        const device = parseDevice(req.headers['user-agent']);
        const location = await getLocation(ip);

        await LoginSession.create({
            userId: user._id, tokenFamily: family,
            refreshToken: hashValue(refreshToken),
            fingerprint: hashedFingerprint,
            ip, userAgent: req.headers['user-agent'] || '',
            device, location, isNewDevice,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        if (isNewDevice) {
            sendNewDeviceAlert({ email: user.email, fullname: user.fullname, device, ip, location, time: new Date().toLocaleString() })
                .catch(() => { });
        }

        const accessToken = generateAccessToken(user._id);
        setRefreshTokenCookie(res, refreshToken);

        // Return user object so frontend can restore session without extra request
        const userResponse = await User.findById(user._id)
            .select('-password -twoFactorOtp -resetPasswordToken -twoFactorOtpExpires')
            .lean();

        return res.status(200).json({ token: accessToken, user: userResponse });
    } catch (error) {
        console.error('Google auth error:', error);
        return res.status(401).json({ error: 'Google authentication failed' });
    }
});

// ─── REFRESH TOKEN ────────────────────────────────────────────────────────────

router.post('/refresh', async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        const fingerprint = req.headers['x-fingerprint'];
        if (!token) return res.status(401).json({ error: 'No refresh token' });
        if (!fingerprint) return res.status(401).json({ error: 'Missing fingerprint' });

        let decoded;
        try { decoded = jwt.verify(token, JWT_REFRESH_SECRET); }
        catch { return res.status(403).json({ error: 'Invalid or expired refresh token' }); }

        const session = await LoginSession.findOne({ userId: decoded.userId, tokenFamily: decoded.family });
        if (!session) return res.status(403).json({ error: 'Session not found' });

        // Reuse detection
        if (session.refreshToken !== hashValue(token)) {
            console.warn(`[SECURITY] Token reuse detected for user ${decoded.userId}`);
            await LoginSession.updateMany({ userId: decoded.userId }, { isRevoked: true });
            return res.status(403).json({ error: 'Token reuse detected. All sessions revoked.' });
        }

        if (session.isRevoked) return res.status(403).json({ error: 'Session revoked' });

        // Fingerprint check
        if (session.fingerprint !== hashValue(fingerprint)) {
            console.warn(`[SECURITY] Fingerprint mismatch for user ${decoded.userId}`);
            return res.status(403).json({ error: 'Browser fingerprint mismatch' });
        }

        const newRefreshToken = generateRefreshToken(decoded.userId, decoded.family);
        await LoginSession.findByIdAndUpdate(session._id, {
            refreshToken: hashValue(newRefreshToken),
            lastUsedAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        const accessToken = generateAccessToken(decoded.userId);
        setRefreshTokenCookie(res, newRefreshToken);

        // ✅ Return user data alongside token so frontend can restore session
        // without a second /api/auth/get request
        const user = await User.findById(decoded.userId)
            .select('-password -twoFactorOtp -resetPasswordToken -twoFactorOtpExpires')
            .lean();

        return res.status(200).json({ token: accessToken, user });
    } catch (error) {
        console.error('Refresh error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── LOGOUT ───────────────────────────────────────────────────────────────────

router.post('/logout', async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (token) await LoginSession.findOneAndUpdate({ refreshToken: hashValue(token) }, { isRevoked: true });
        res.clearCookie('refreshToken');
        return res.status(200).json({ message: 'Logged out successfully' });
    } catch {
        res.clearCookie('refreshToken');
        return res.status(200).json({ message: 'Logged out' });
    }
});

// ─── GET SESSIONS ─────────────────────────────────────────────────────────────

router.get('/sessions', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });

        if (!JWT_SECRET) {
            logger.error('[TOKEN_VERIFY] JWT_SECRET is not set');
            return res.status(500).json({ message: 'Server configuration error' });
        }

        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            logger.error('[SESSIONS] JWT verification failed:', { error: err.message, name: err.name });
            return res.status(403).json({ message: 'Invalid or expired token' });
        }

        const sessions = await LoginSession.find({
            userId: decoded.userId, isRevoked: false, expiresAt: { $gt: new Date() },
        }).select('-refreshToken -fingerprint').sort({ lastUsedAt: -1 });
        return res.status(200).json(sessions);
    } catch (error) {
        logger.error('[SESSIONS] Unexpected error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// ─── REVOKE SESSION ───────────────────────────────────────────────────────────

router.delete('/sessions/:sessionId', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });
        const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        const session = await LoginSession.findOneAndUpdate(
            { _id: req.params.sessionId, userId: decoded.userId },
            { isRevoked: true }
        );
        if (!session) return res.status(404).json({ error: 'Session not found' });
        return res.status(200).json({ message: 'Session revoked' });
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ─── FORGOT / RESET PASSWORD ──────────────────────────────────────────────────

router.post('/forgot-password', resetLimiter, [body('email').isEmail()], async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user || user.authProvider !== 'local') return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
        await user.save();
        await sendResetEmail(email, `${CLIENT_URL}/reset-password?token=${resetToken}&email=${email}`);
        return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/reset-password', resetLimiter, [body('token').notEmpty(), body('email').isEmail(), body('password').isLength({ min: 6 })], async (req, res) => {
    try {
        const { token, email, password } = req.body;
        const user = await User.findOne({
            email: email.toLowerCase().trim(),
            resetPasswordToken: crypto.createHash('sha256').update(token).digest('hex'),
            resetPasswordExpires: { $gt: Date.now() },
        });
        if (!user) return res.status(400).json({ error: 'Invalid or expired reset token.' });
        const decryptedPassword = isEncrypted(password) ? decryptPassword(password) : password;
        user.password = await bcrypt.hash(decryptedPassword, 12);
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();
        await LoginSession.updateMany({ userId: user._id }, { isRevoked: true });
        return res.status(200).json({ message: 'Password reset successful. Please log in.' });
    } catch (error) {
        console.error('Reset password error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET LOGGED USER + OTHER ROUTES ──────────────────────────────────────────

router.get('/get', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized.' });

        if (!JWT_SECRET) {
            logger.error('[TOKEN_VERIFY] JWT_SECRET is not set');
            return res.status(500).json({ message: 'Server configuration error' });
        }

        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            logger.error('[GET_USER] JWT verification failed:', { error: err.message, name: err.name });
            return res.status(403).json({ message: 'Invalid or expired token.' });
        }

        const user = await User.findById(decoded.userId).select('-password -resetPasswordToken -resetPasswordExpires -twoFactorOtp');
        if (!user) return res.status(404).json({ message: 'User not found.' });
        return res.status(200).json(user);
    } catch (error) {
        logger.error('[GET_USER] Unexpected error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

router.get("/other-users", verifyToken, async (req, res) => {
    try {
        const loggedUserId = req.userId;
        const user = await User.findById(loggedUserId).select("-password").populate("following", "_id");
        if (!user) return res.status(404).json({ message: "User not found." });

        // Suggest users who the logged user is not following, but are followed by people the logged user follows
        const suggestions = await User.find({
            _id: { $ne: loggedUserId, $nin: user.following },
            followers: { $in: user.following }
        }).limit(20).select("_id fullname profile_picture");

        return res.status(200).json(suggestions);
    } catch (error) {
        logger.error('Other users fetch error:', error);
        return res.status(500).json({ message: "Internal server error." });
    }
});

router.post('/users/details', async (req, res) => {
    try {
        const users = await User.find({ _id: { $in: req.body.ids } }).select('fullname profile_picture');
        res.status(200).json({ users });
    } catch { res.status(500).json({ error: 'Failed to fetch user details' }); }
});

router.put('/update-profile', async (req, res) => {
    try {
        const { userId, fullname, email, profile_picture, bio } = req.body;
        if (!userId) return res.status(400).json({ message: 'User ID is required.' });
        const updatedUser = await User.findByIdAndUpdate(userId, { fullname, email, profile_picture, bio }, { new: true }).select('-password');
        if (!updatedUser) return res.status(404).json({ message: 'User not found.' });
        res.status(200).json(updatedUser);
    } catch { res.status(500).json({ message: 'Failed to update profile.' }); }
});

router.post('/follow', async (req, res) => {
    try {
        const { userId, followUserId } = req.body;
        await User.findByIdAndUpdate(userId, { $addToSet: { following: followUserId } });
        const user = await User.findByIdAndUpdate(followUserId, { $addToSet: { followers: userId } }).select("-password");
        res.status(200).json(user);
    } catch { res.status(500).json({ message: 'Failed to follow user.' }); }
});

router.post('/unfollow', async (req, res) => {
    try {
        const { userId, unfollowUserId } = req.body;
        await User.findByIdAndUpdate(userId, { $pull: { following: unfollowUserId } });
        const user = await User.findByIdAndUpdate(unfollowUserId, { $pull: { followers: userId } }).select("-password");
        res.status(200).json(user);
    } catch { res.status(500).json({ message: 'Failed to unfollow user.' }); }
});

router.get('/other-user/view/:id', verifyToken, async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found.' });
        return res.status(200).json(user);
    } catch (error) {
        logger.error('[OTHER_USER_VIEW] Error:', error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

router.post("/search", async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ message: "Search query is required." });

    try {
        // Escape special regex characters to prevent crashes
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const [userResults, postResults] = await Promise.all([
            User.find({ fullname: { $regex: escapedQuery, $options: "i" } }).select("-password"),
            Post.find({ category: { $regex: escapedQuery, $options: "i" } }),
        ]);
        res.status(200).json({ users: userResults, posts: postResults });
    } catch (error) {
        logger.error(`Search error for query "${query}":`, error);
        res.status(500).json({ message: "Internal server error." });
    }
});

// ─── NOTIFICATION SETTINGS ───────────────────────────────────────────────────
router.get('/notification-settings', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('notificationSettings').lean();
        res.json(user?.notificationSettings || { emailDigest: false, pushEnabled: true });
    } catch { res.status(401).json({ message: 'Unauthorized' }); }
});

router.patch('/notification-settings', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findByIdAndUpdate(decoded.userId, { notificationSettings: req.body }, { new: true }).select('notificationSettings').lean();
        res.json(user.notificationSettings);
    } catch { res.status(401).json({ message: 'Unauthorized' }); }
});

// ─── VERIFY PASSWORD (for admin re-auth gate) ────────────────────────────────
router.post('/verify-password', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('+password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Google/OAuth users have no password
        if (!user.password) return res.status(400).json({ message: 'Password login not available for this account' });

        const bcrypt = require('bcryptjs');
        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Incorrect password' });

        res.status(200).json({ message: 'Verified' });
    } catch (err) {
        res.status(401).json({ message: 'Invalid token' });
    }
});

module.exports = router;