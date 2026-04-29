const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Post = require('../models/Post');
const LoginSession = require('../models/LoginSession');
const { decryptPassword, isEncrypted } = require('../utils/crypto');
const { hashValue, generateFamily, parseDevice, getLocation, getIp } = require('../utils/authSecurity');
const { sendNewDeviceAlert, sendResetEmail, sendOtpEmail, sendLockoutEmail, sendVerificationEmail, sendSessionRevokedEmail, sendEmail } = require('../utils/mailer');
const { getSuggestedUsers } = require('../services/suggestionService');
const { createNotification } = require('../lib/notification');
const logger = require('../utils/logger');
const verifyToken = require('../middleware/Verifytoken');
const authRateLimiter = require('../middleware/authRateLimiter');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// ✅ Privacy: Standard exclusions for user responses
// For the logged-in user (OWN), we exclude security tokens but keep email/settings
const OWN_USER_EXCLUSIONS = '-password -twoFactorOtp -twoFactorOtpExpires -resetPasswordToken -resetPasswordExpires -emailVerificationToken -emailVerificationTokenSentAt -loginSessions -__v';

// For other users (OTHER), we exclude almost everything personal/sensitive
const OTHER_USER_EXCLUSIONS = '-password -email -loginSessions -notificationSettings -resetPasswordToken -resetPasswordExpires -twoFactorOtp -twoFactorOtpExpires -failedLoginAttempts -lockoutUntil -googleId -githubId -emailVerificationToken -emailVerificationTokenSentAt -dismissedUsers -__v';

if (!JWT_SECRET || !JWT_REFRESH_SECRET) { console.error('Missing JWT secrets'); process.exit(1); }

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateAccessToken(userId, family) {
    return crypto.randomBytes(48).toString('hex');
}
function generateRefreshToken(userId, family) {
    return crypto.randomBytes(48).toString('hex');
}

function getRefreshCookieOptions(isForClear = false) {
    const fromEnvSecure = process.env.COOKIE_SECURE;
    const inferredSecure = process.env.NODE_ENV === 'production'
        || (/^https:\/\//i.test(CLIENT_URL) && !/localhost|127\.0\.0\.1/i.test(CLIENT_URL));
    const secure = typeof fromEnvSecure === 'string' ? fromEnvSecure === 'true' : inferredSecure;

    const fromEnvSameSite = process.env.COOKIE_SAMESITE?.toLowerCase();
    const sameSite = fromEnvSameSite || (secure ? 'none' : 'lax');
    const domain = process.env.COOKIE_DOMAIN?.trim();

    const options = {
        httpOnly: true,
        secure,
        sameSite,
        path: '/',
        ...(domain ? { domain } : {}),
    };

    if (!isForClear) {
        options.maxAge = 30 * 24 * 60 * 60 * 1000;
    }

    return options;
}

function setRefreshTokenCookie(res, token) {
    res.cookie('refreshToken', token, getRefreshCookieOptions());
}

function clearRefreshTokenCookie(res) {
    res.clearCookie('refreshToken', getRefreshCookieOptions(true));
}
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

async function generateUniqueUsername(fullname) {
    let base = fullname.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
    if (!base) base = 'user';

    // Find all usernames that start with the base
    const existingUsers = await User.find({
        username: new RegExp(`^${base}[0-9]*$`, 'i')
    }).select('username').lean();

    if (existingUsers.length === 0) return base;

    const usernames = new Set(existingUsers.map(u => u.username.toLowerCase()));
    if (!usernames.has(base)) return base;

    let counter = 1;
    while (usernames.has(`${base}${counter}`)) {
        counter++;
    }
    return `${base}${counter}`;
}

// verifyToken middleware imported from ../middleware/Verifytoken

// ─── LOGIN ────────────────────────────────────────────────────────────────────

router.post('/login', authRateLimiter, [
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

            // ── SECURITY NOTIFICATION FOR FAILED ATTEMPT ──
            const ip = getIp(req);
            const device = parseDevice(req.headers['user-agent']);
            createNotification({
                recipientId: user._id,
                sender: {
                    id: user._id,
                    fullname: 'Security Shield',
                    profile_picture: 'https://img.icons8.com/fluency/96/security-shield.png'
                },
                type: 'system',
                message: { content: `⚠️ Security Alert: An incorrect login attempt was made via ${device} at IP ${ip}. If this wasn't you, please secure your account.` }
            }).catch(e => logger.error('Failed to send login alert:', e));

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

        const hashedFingerprint = hashValue(fingerprint);
        let existingSession = await LoginSession.findOne({
            userId: user._id,
            fingerprint: hashedFingerprint
        }).sort({ createdAt: -1 });

        const isActivatingNewSession = !existingSession || existingSession.isRevoked || existingSession.expiresAt < new Date();

        const activeSessionsCount = await LoginSession.countDocuments({
            userId: user._id,
            isRevoked: false,
            expiresAt: { $gt: new Date() }
        });

        if (isActivatingNewSession && activeSessionsCount >= 10) {
            return res.status(403).json({ error: '10 login session exceeded logout first' });
        }

        // ── 2FA CHECK ──
        if (user.twoFactorEnabled) {
            const otp = generateOtp();
            user.twoFactorOtp = hashValue(otp);
            user.twoFactorOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
            await user.save();
            await sendOtpEmail(user.email, user.fullname, otp);
            return res.status(200).json({ requiresOtp: true, userId: user._id });
        }

        // Safety fix for corrupted preferredMood (empty string)
        if (user.preferredMood === "") user.preferredMood = null;
        await user.save();

        // ── SESSION CREATION OR REUSE ──
        const isNewDevice = !existingSession;
        const family = generateFamily();
        const accessToken = generateAccessToken(user._id, family);
        const refreshToken = generateRefreshToken(user._id, family);
        const ip = getIp(req);
        const device = parseDevice(req.headers['user-agent']);
        const location = await getLocation(ip);

        if (existingSession) {
            existingSession.tokenFamily = family;
            existingSession.accessToken = hashValue(accessToken);
            existingSession.refreshToken = hashValue(refreshToken);
            existingSession.isRevoked = false;
            existingSession.ip = ip;
            existingSession.userAgent = req.headers['user-agent'] || '';
            existingSession.device = device;
            existingSession.location = location;
            existingSession.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            await existingSession.save();
        } else {
            await LoginSession.create({
                userId: user._id, tokenFamily: family,
                accessToken: hashValue(accessToken),
                refreshToken: hashValue(refreshToken),
                fingerprint: hashedFingerprint,
                ip, userAgent: req.headers['user-agent'] || '',
                device, location, isNewDevice,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            });
        }

        if (isNewDevice) {
            sendNewDeviceAlert(user.email, { device, ip, location, time: new Date().toLocaleString() })
                .catch(err => console.warn('Alert email failed:', err.message));
        }

        // ── SECURITY NOTIFICATION FOR SUCCESSFUL LOGIN ──
        createNotification({
            recipientId: user._id,
            sender: {
                id: user._id,
                fullname: 'Security Shield',
                profile_picture: 'https://img.icons8.com/fluency/96/security-shield.png'
            },
            type: 'system',
            message: { content: `✅ New Login: Your account was accessed via ${device} (${ip})${location ? ` in ${location.city}, ${location.country}` : ''}.` }
        }).catch(e => logger.error('Failed to send login alert:', e));

        setRefreshTokenCookie(res, refreshToken);

        // Return user object so frontend can restore session without extra request
        const userResponse = await User.findById(user._id)
            .select(OWN_USER_EXCLUSIONS)
            .lean();

        return res.status(200).json({ token: accessToken, user: userResponse });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── VERIFY OTP ───────────────────────────────────────────────────────────────

router.post('/verify-otp', [
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

        // ── SESSION CREATION OR REUSE ──
        const hashedFingerprint = hashValue(fingerprint);
        let existingSession = await LoginSession.findOne({
            userId: user._id,
            fingerprint: hashedFingerprint
        }).sort({ createdAt: -1 });

        const isActivatingNewSession = !existingSession || existingSession.isRevoked || existingSession.expiresAt < new Date();

        const activeSessionsCount = await LoginSession.countDocuments({
            userId: user._id,
            isRevoked: false,
            expiresAt: { $gt: new Date() }
        });

        if (isActivatingNewSession && activeSessionsCount >= 3) {
            return res.status(403).json({ error: 'login session exceeded logout first' });
        }

        const isNewDevice = !existingSession;
        const family = generateFamily();
        const accessToken = generateAccessToken(user._id, family);
        const refreshToken = generateRefreshToken(user._id, family);
        const ip = getIp(req);
        const device = parseDevice(req.headers['user-agent']);
        const location = await getLocation(ip);

        if (existingSession) {
            existingSession.tokenFamily = family;
            existingSession.accessToken = hashValue(accessToken);
            existingSession.refreshToken = hashValue(refreshToken);
            existingSession.isRevoked = false;
            existingSession.ip = ip;
            existingSession.userAgent = req.headers['user-agent'] || '';
            existingSession.device = device;
            existingSession.location = location;
            existingSession.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            await existingSession.save();
        } else {
            await LoginSession.create({
                userId: user._id, tokenFamily: family,
                accessToken: hashValue(accessToken),
                refreshToken: hashValue(refreshToken),
                fingerprint: hashedFingerprint,
                ip, userAgent: req.headers['user-agent'] || '',
                device, location, isNewDevice,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            });
        }

        if (isNewDevice) {
            sendNewDeviceAlert(user.email, { device, ip, location, time: new Date().toLocaleString() })
                .catch(() => { });
        }

        // ── SECURITY NOTIFICATION FOR SUCCESSFUL LOGIN (OTP) ──
        createNotification({
            recipientId: user._id,
            sender: {
                id: user._id,
                fullname: 'Security Shield',
                profile_picture: 'https://img.icons8.com/fluency/96/security-shield.png'
            },
            type: 'system',
            message: { content: `✅ Secure Login: Your account was accessed via ${device} (OTP verified) at IP ${ip}.` }
        }).catch(e => logger.error('Failed to send login alert:', e));

        setRefreshTokenCookie(res, refreshToken);

        // Return user object so frontend can restore session without extra request
        const userResponse = await User.findById(user._id)
            .select(OWN_USER_EXCLUSIONS)
            .lean();

        return res.status(200).json({ token: accessToken, user: userResponse });
    } catch (error) {
        console.error('OTP verify error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── TOGGLE 2FA ───────────────────────────────────────────────────────────────

router.post('/toggle-2fa', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.twoFactorEnabled = !user.twoFactorEnabled;
        await user.save();
        return res.status(200).json({ twoFactorEnabled: user.twoFactorEnabled });
    } catch {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── SIGNUP ───────────────────────────────────────────────────────────────────

router.post('/add', authRateLimiter, [
    body('fullname').trim().isLength({ min: 2, max: 50 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6, max: 128 }),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { fullname, email, password, fingerprint } = req.body;
        if (!fingerprint) return res.status(400).json({ error: 'Missing browser fingerprint' });

        const decryptedPassword = isEncrypted(password) ? decryptPassword(password) : password;
        const existing = await User.findOne({ email: email.toLowerCase().trim() });
        if (existing) return res.status(400).json({ message: 'User already exists with this email.' });

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const hashedVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

        const hashedPassword = await bcrypt.hash(decryptedPassword, 12);

        const username = await generateUniqueUsername(fullname);

        const newUser = new User({
            fullname: fullname.trim(),
            username,
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            authProvider: 'local',
            emailVerificationToken: hashedVerificationToken,
            isEmailVerified: true,
        });
        await newUser.save();

        // Send verification email
        const verificationUrl = `${CLIENT_URL}/verify-email/${verificationToken}`;
        // sendVerificationEmail(newUser.email, verificationUrl).catch(err => logger.error('[SIGNUP] Verification email failed:', err));

        const family = generateFamily();
        const accessToken = generateAccessToken(newUser._id, family);
        const refreshToken = generateRefreshToken(newUser._id, family);
        const ip = getIp(req);
        const device = parseDevice(req.headers['user-agent']);
        const location = await getLocation(ip);

        await LoginSession.create({
            userId: newUser._id, tokenFamily: family,
            accessToken: hashValue(accessToken),
            refreshToken: hashValue(refreshToken),
            fingerprint: hashValue(fingerprint),
            ip, userAgent: req.headers['user-agent'] || '',
            device, location, isNewDevice: true,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });

        setRefreshTokenCookie(res, refreshToken);

        // Return user object so frontend can restore session without extra request
        const userResponse = await User.findById(newUser._id)
            .select(OWN_USER_EXCLUSIONS)
            .lean();

        return res.status(201).json({ token: accessToken, user: userResponse });
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ message: 'Failed to register user.' });
    }
});

// ─── GOOGLE OAUTH ─────────────────────────────────────────────────────────────

router.post('/google', async (req, res) => {
    try {
        const { credential, fingerprint } = req.body;
        if (!credential || !fingerprint) return res.status(400).json({ error: 'Missing credential or fingerprint' });

        const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
        const { sub: googleId, email, name, picture } = ticket.getPayload();

        let user = await User.findOne({ $or: [{ googleId }, { email }] });
        if (!user) {
            const username = await generateUniqueUsername(name);
            user = new User({ fullname: name, username, email, profile_picture: picture, googleId, authProvider: 'google' });
        } else {
            user.googleId = googleId;
            if (!user.username) user.username = await generateUniqueUsername(name);
            if (!user.profile_picture || user.profile_picture.includes('OIP')) user.profile_picture = picture;
        }
        await user.save();

        // ── SESSION CREATION OR REUSE ──
        const hashedFingerprint = hashValue(fingerprint);
        let existingSession = await LoginSession.findOne({
            userId: user._id,
            fingerprint: hashedFingerprint
        }).sort({ createdAt: -1 });

        const isActivatingNewSession = !existingSession || existingSession.isRevoked || existingSession.expiresAt < new Date();

        const activeSessionsCount = await LoginSession.countDocuments({
            userId: user._id,
            isRevoked: false,
            expiresAt: { $gt: new Date() }
        });

        if (isActivatingNewSession && activeSessionsCount >= 3) {
            return res.status(403).json({ error: 'login session exceeded logout first' });
        }

        const isNewDevice = !existingSession;
        const family = generateFamily();
        const accessToken = generateAccessToken(user._id, family);
        const refreshToken = generateRefreshToken(user._id, family);
        const ip = getIp(req);
        const device = parseDevice(req.headers['user-agent']);
        const location = await getLocation(ip);

        if (existingSession) {
            existingSession.tokenFamily = family;
            existingSession.accessToken = hashValue(accessToken);
            existingSession.refreshToken = hashValue(refreshToken);
            existingSession.isRevoked = false;
            existingSession.ip = ip;
            existingSession.userAgent = req.headers['user-agent'] || '';
            existingSession.device = device;
            existingSession.location = location;
            existingSession.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            await existingSession.save();
        } else {
            await LoginSession.create({
                userId: user._id, tokenFamily: family,
                accessToken: hashValue(accessToken),
                refreshToken: hashValue(refreshToken),
                fingerprint: hashedFingerprint,
                ip, userAgent: req.headers['user-agent'] || '',
                device, location, isNewDevice,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            });
        }

        if (isNewDevice) {
            sendNewDeviceAlert(user.email, { device, ip, location, time: new Date().toLocaleString() })
                .catch(() => { });
        }

        setRefreshTokenCookie(res, refreshToken);

        // Return user object so frontend can restore session without extra request
        const userResponse = await User.findById(user._id)
            .select(OWN_USER_EXCLUSIONS)
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

        const hashedToken = hashValue(token);
        const session = await LoginSession.findOne({ refreshToken: hashedToken });
        if (!session) return res.status(403).json({ error: 'Session not found' });

        if (session.isRevoked) return res.status(403).json({ error: 'Session revoked' });
        if (session.expiresAt < new Date()) return res.status(403).json({ error: 'Session expired' });

        // Fingerprint check
        if (session.fingerprint !== hashValue(fingerprint)) {
            console.warn(`[SECURITY] Fingerprint mismatch for user ${session.userId}`);
            return res.status(403).json({ error: 'Browser fingerprint mismatch' });
        }

        const newAccessToken = generateAccessToken(session.userId, session.tokenFamily);
        const newRefreshToken = generateRefreshToken(session.userId, session.tokenFamily);

        await LoginSession.findByIdAndUpdate(session._id, {
            accessToken: hashValue(newAccessToken),
            refreshToken: hashValue(newRefreshToken),
            lastUsedAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });

        setRefreshTokenCookie(res, newRefreshToken);

        const user = await User.findById(session.userId)
            .select(OWN_USER_EXCLUSIONS)
            .lean();

        return res.status(200).json({ token: newAccessToken, user });
    } catch (error) {
        console.error('Refresh error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── LOGOUT ───────────────────────────────────────────────────────────────────

router.post('/logout', async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (token) {
            await LoginSession.findOneAndUpdate(
                { refreshToken: hashValue(token) },
                { isRevoked: true, accessToken: null, refreshToken: null }
            );
        }
        clearRefreshTokenCookie(res);
        return res.status(200).json({ message: 'Logged out successfully' });
    } catch {
        clearRefreshTokenCookie(res);
        return res.status(200).json({ message: 'Logged out' });
    }
});

// ─── GET SESSIONS ─────────────────────────────────────────────────────────────

router.get('/sessions', verifyToken, async (req, res) => {
    try {
        const sessions = await LoginSession.find({
            userId: req.userId, isRevoked: false, expiresAt: { $gt: new Date() },
        }).select('-refreshToken -fingerprint').sort({ lastUsedAt: -1 }).lean();

        const mappedSessions = sessions.map(session => ({
            ...session,
            isCurrentSession: session._id.toString() === req.sessionId.toString()
        }));

        return res.status(200).json(mappedSessions);
    } catch (error) {
        logger.error('[SESSIONS] Unexpected error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// ─── REVOKE SESSION ───────────────────────────────────────────────────────────

router.delete('/sessions/:sessionId', verifyToken, async (req, res) => {
    try {
        const session = await LoginSession.findOneAndUpdate(
            { _id: req.params.sessionId, userId: req.userId },
            { isRevoked: true }
        );
        if (!session) return res.status(404).json({ error: 'Session not found' });

        // ✅ Security Alert: Send email about revoked session
        const user = await User.findById(req.userId).select('email');
        if (user?.email) {
            sendSessionRevokedEmail(user.email, {
                device: session.deviceName,
                location: session.location,
                ip: session.ip
            }).catch(err => console.error('[Security] Failed to send revocation email:', err.message));
        }

        return res.status(200).json({ message: 'Session revoked' });
    } catch (error) {
        console.error('Revoke session error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── REVOKE ALL SESSIONS ──────────────────────────────────────────────────────
router.delete('/sessions/all/revoke', verifyToken, async (req, res) => {
    try {
        await LoginSession.updateMany(
            { userId: req.userId, tokenFamily: { $ne: req.family } },
            { isRevoked: true }
        );

        // ✅ Security Alert: Notify user that other sessions were cleared
        const user = await User.findById(req.userId).select('email');
        if (user?.email) {
            sendEmail({
                to: user.email,
                subject: '🛡️ Other sessions terminated — Social Square',
                html: `
                <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px">
                    <h2 style="color:#6366f1">Security Cleanup</h2>
                    <p>As requested, all other active sessions for your account have been terminated.</p>
                    <p style="color:#6b7280;font-size:12px">If this wasn't you, your account may be compromised. Please change your password immediately.</p>
                </div>`
            }).catch(err => console.error('[Security] Failed to send bulk revocation email:', err.message));
        }

        return res.status(200).json({ message: 'Other sessions revoked' });
    } catch (error) {
        console.error('Revoke all error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── FORGOT / RESET PASSWORD ──────────────────────────────────────────────────

router.post('/forgot-password', [body('email').isEmail()], async (req, res) => {
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

router.post('/reset-password', [body('token').notEmpty(), body('email').isEmail(), body('password').isLength({ min: 6, max: 128 })], async (req, res) => {
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

// ─── EMAIL VERIFICATION ───────────────────────────────────────────────────────

router.get('/verify-email/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            emailVerificationToken: hashedToken,
            isEmailVerified: false
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired verification token.' });
        }

        user.isEmailVerified = true;
        user.emailVerificationToken = null;
        await user.save();

        return res.status(200).json({ message: 'Email verified successfully! You can now log in.' });
    } catch (error) {
        console.error('Email verification error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/resend-verification', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.isEmailVerified) return res.status(400).json({ error: 'Email already verified' });

        // Cooldown check (5 mins)
        const lastSent = user.emailVerificationTokenSentAt || 0;
        if (Date.now() - lastSent < 5 * 60 * 1000) {
            return res.status(429).json({ error: 'Please wait 5 minutes before resending.' });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        user.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
        user.emailVerificationTokenSentAt = Date.now();
        await user.save();

        const verificationUrl = `${CLIENT_URL}/verify-email/${verificationToken}`;
        await sendVerificationEmail(user.email, verificationUrl);
        return res.status(200).json({ message: 'Verification link sent and delivered to your inbox.' });
    } catch (error) {
        console.error('Resend verification error:', error);
        return res.status(500).json({ error: 'Failed to resend verification email.' });
    }
});

// ─── GET LOGGED USER + OTHER ROUTES ──────────────────────────────────────────

router.get('/get', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password -resetPasswordToken -resetPasswordExpires -twoFactorOtp');
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
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const suggestions = await getSuggestedUsers(loggedUserId, limit, page);

        return res.status(200).json(suggestions);
    } catch (error) {
        logger.error('Other users fetch error:', error);
        return res.status(500).json({ message: "Internal server error." });
    }
});

// ─── OTHER USER PROFILE VIEW ──────────────────────────────────────────────────
router.get('/other-user/view/:id', verifyToken, async (req, res) => {
    try {
        const targetId = req.params.id;
        const loggedUserId = req.userId;

        if (!mongoose.Types.ObjectId.isValid(targetId)) {
            return res.status(400).json({ message: 'Invalid user ID.' });
        }

        const targetUser = await User.findById(targetId)
            .select('-password -email -loginSessions -notificationSettings -resetPasswordToken -resetPasswordExpires -twoFactorOtp -twoFactorOtpExpires -failedLoginAttempts -lockoutUntil -googleId -githubId -emailVerificationToken')
            .lean();

        if (!targetUser) return res.status(404).json({ message: 'User not found.' });

        const loggedUser = await User.findById(loggedUserId)
            .select('following followers blockedUsers')
            .lean();

        const isFollowing = (loggedUser?.following || []).some(id => id.toString() === targetId.toString());
        const hasPendingRequest = (targetUser.followRequests || []).some(id => id.toString() === loggedUserId.toString());

        // Mutual followers: people in both logged user's followers AND target's followers
        const loggedFollowerIds = (loggedUser?.followers || []).map(id => id.toString());
        const targetFollowerIds = (targetUser.followers || []).map(id => id.toString());
        const mutualIds = loggedFollowerIds.filter(id => targetFollowerIds.includes(id) && id !== loggedUserId.toString());

        let mutualDetails = [];
        if (mutualIds.length > 0) {
            mutualDetails = await User.find({ _id: { $in: mutualIds.slice(0, 3) } })
                .select('fullname username profile_picture')
                .lean();
        }

        // Privacy: if private and not a follower, hide follower/following lists
        const isOwner = targetId === loggedUserId.toString();
        const canSeeDetails = isOwner || isFollowing || !targetUser.isPrivate;

        return res.status(200).json({
            ...targetUser,
            followers: canSeeDetails ? targetUser.followers : [],
            following: canSeeDetails ? targetUser.following : [],
            followerCount: (targetUser.followers || []).length,
            followingCount: (targetUser.following || []).length,
            isFollowing,
            hasPendingRequest,
            mutualFollowers: mutualDetails,
            mutualCount: mutualIds.length,
        });
    } catch (error) {
        logger.error('[OTHER_USER_VIEW] Error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// ─── PUBLIC USER PROFILE VIEW (Logged-out) ────────────────────────────────────
router.get('/public/profile/:identifier', async (req, res) => {
    try {
        const identifier = req.params.identifier;
        let query = {};

        if (mongoose.Types.ObjectId.isValid(identifier)) {
            query = { _id: identifier };
        } else {
            query = { username: identifier };
        }

        const user = await User.findOne(query)
            .select('fullname username profile_picture bio isPrivate followers following level streak xp profileViews')
            .lean();

        if (!user) return res.status(404).json({ message: 'User not found.' });

        // Set cache headers for aggressive CDN caching (5 minutes)
        res.setHeader('Cache-Control', 'public, max-age=300');

        // Security: Strictly return ONLY counts and fix data. NO arrays.
        return res.status(200).json({
            _id: user._id,
            fullname: user.fullname,
            username: user.username,
            profile_picture: user.profile_picture,
            bio: user.bio,
            isPrivate: user.isPrivate,
            followerCount: (user.followers || []).length,
            followingCount: (user.following || []).length,
            level: user.level || 1,
            streak: user.streak || { count: 0 },
            xp: user.xp || 0,
            profileViews: user.profileViews || 0
        });
    } catch (error) {
        logger.error('[PUBLIC_USER_VIEW] Error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/users/details', verifyToken, async (req, res) => {
    try {
        let ids = Array.isArray(req.body.ids) ? req.body.ids : [];
        // Sanitize: filter out any non-string or invalid ObjectIds
        ids = ids.filter(id => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id));

        if (!ids.length) return res.status(200).json({ users: [] });
        const users = await User.find({ _id: { $in: ids } }).select('fullname username profile_picture');
        res.status(200).json({ users });
    } catch (e) {
        logger.error('[USERS_DETAILS] Error:', e.message);
        res.status(500).json({ error: 'Failed to fetch user details' });
    }
});

router.put('/update-profile', verifyToken, async (req, res) => {
    try {
        const { userId, fullname, username, email, profile_picture, bio, preferredMood, isPrivate } = req.body;
        const loggedUserId = req.userId;

        if (!userId || String(userId) !== String(loggedUserId)) {
            return res.status(403).json({ message: 'Unauthorized. You can only update your own profile.' });
        }

        if (username) {
            const exists = await User.findOne({ username, _id: { $ne: userId } });
            if (exists) return res.status(400).json({ message: 'Username is already taken.' });
        }

        const updateData = { fullname, username, email, profile_picture, bio, preferredMood };
        if (typeof isPrivate === 'boolean') updateData.isPrivate = isPrivate;

        const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true }).select(OWN_USER_EXCLUSIONS);
        if (!updatedUser) return res.status(404).json({ message: 'User not found.' });
        res.status(200).json(updatedUser);
    } catch { res.status(500).json({ message: 'Failed to update profile.' }); }
});

router.put('/mark-welcome-seen', verifyToken, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.userId, { hasSeenWelcome: true }, { new: true }).select(OWN_USER_EXCLUSIONS);
        if (!user) return res.status(404).json({ error: 'User not found' });
        return res.status(200).json(user);
    } catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/follow', verifyToken, async (req, res) => {
    try {
        const { userId, followUserId } = req.body;
        const loggedUserId = req.userId;

        if (!userId || String(userId) !== String(loggedUserId)) {
            return res.status(403).json({ message: 'Unauthorized.' });
        }

        const targetUser = await User.findById(followUserId).select(OTHER_USER_EXCLUSIONS);
        if (!targetUser) return res.status(404).json({ message: 'Target user not found' });

        // If target is private, add to followRequests instead of followers
        if (targetUser.isPrivate) {
            // Already following?
            if (targetUser.followers.includes(userId)) return res.status(200).json({
                _id: followUserId,
                requested: false,
                alreadyFollowing: true,
                followerCount: targetUser.followers?.length || 0
            });

            // Already requested?
            if (targetUser.followRequests.includes(userId)) return res.status(200).json({
                _id: followUserId,
                requested: true,
                alreadyRequested: true,
                followRequestsCount: targetUser.followRequests?.length || 0
            });

            const updatedTarget = await User.findByIdAndUpdate(
                followUserId,
                { $addToSet: { followRequests: userId } },
                { new: true }
            ).select(OTHER_USER_EXCLUSIONS);

            // Create notification for follow request
            const sender = await User.findById(userId).select('fullname profile_picture');
            await require('../lib/notification.js').createNotification({
                recipientId: followUserId,
                sender: { id: userId, fullname: sender.fullname, profile_picture: sender.profile_picture },
                type: 'follow_request',
            });

            return res.status(200).json({
                _id: followUserId,
                requested: true,
                isPrivate: true,
                followerCount: updatedTarget.followers?.length || 0,
            });
        }

        // Public account logic
        await User.findByIdAndUpdate(userId, { $addToSet: { following: followUserId } });
        const user = await User.findByIdAndUpdate(followUserId, { $addToSet: { followers: userId } }, { new: true }).select(OTHER_USER_EXCLUSIONS);

        // Notification for immediate follow
        const sender = await User.findById(userId).select('fullname profile_picture');
        await require('../lib/notification.js').createNotification({
            recipientId: followUserId,
            sender: { id: userId, fullname: sender.fullname, profile_picture: sender.profile_picture },
            type: 'follow',
        });

        res.status(200).json({
            _id: followUserId,
            requested: false,
            followerCount: user.followers?.length || 0,
            followingCount: user.following?.length || 0
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to follow user.' });
    }
});

// ─── UNFOLLOW ─────────────────────────────────────────────────────────────────
router.post('/unfollow', verifyToken, async (req, res) => {
    try {
        const { userId, unfollowUserId } = req.body;
        const loggedUserId = req.userId;

        if (!unfollowUserId) return res.status(400).json({ message: 'Target user ID required.' });

        const targetId = unfollowUserId || userId; // support both param names
        const meId = userId || loggedUserId;

        // Remove from both sides
        await User.findByIdAndUpdate(meId, { $pull: { following: targetId } });
        const updatedTarget = await User.findByIdAndUpdate(
            targetId,
            { $pull: { followers: meId } },
            { new: true }
        ).select(OTHER_USER_EXCLUSIONS);

        res.status(200).json({
            _id: targetId,
            followerCount: updatedTarget?.followers?.length || 0
        });
    } catch (error) {
        console.error('[UNFOLLOW]', error);
        res.status(500).json({ message: 'Failed to unfollow user.' });
    }
});

// ─── REMOVE FOLLOWER ──────────────────────────────────────────────────────────
router.post('/remove-follower', verifyToken, async (req, res) => {
    try {
        const { userId, followerId } = req.body;
        const loggedUserId = req.userId;

        if (!userId || String(userId) !== String(loggedUserId)) {
            return res.status(403).json({ message: 'Unauthorized.' });
        }

        if (!followerId) return res.status(400).json({ message: 'Follower ID required.' });

        // Remove followerId from userId's followers
        await User.findByIdAndUpdate(userId, { $pull: { followers: followerId } });
        // Remove userId from followerId's following
        await User.findByIdAndUpdate(followerId, { $pull: { following: userId } });

        res.status(200).json({ message: 'Follower removed' });
    } catch (error) {
        console.error('[REMOVE-FOLLOWER]', error);
        res.status(500).json({ message: 'Failed to remove follower.' });
    }
});

router.post('/follow-request/accept', verifyToken, async (req, res) => {
    try {
        const { userId, requesterId } = req.body; // userId is ME (the one accepting)
        const loggedUserId = req.userId;

        if (String(userId) !== String(loggedUserId)) {
            return res.status(403).json({ message: 'Unauthorized.' });
        }

        // Remove from requests, add to followers
        await User.findByIdAndUpdate(userId, {
            $pull: { followRequests: requesterId },
            $addToSet: { followers: requesterId }
        });

        // Also update the requester's following list
        await User.findByIdAndUpdate(requesterId, {
            $addToSet: { following: userId }
        });

        // Create notification for the requester
        const sender = await User.findById(userId).select('fullname profile_picture');
        await require('../lib/notification.js').createNotification({
            recipientId: requesterId,
            sender: { id: userId, fullname: sender.fullname, profile_picture: sender.profile_picture },
            type: 'follow_accept', // Person accepted your request
        });
        // Mark the follow request notification as accepted
        await require('../lib/notification.js').updateNotifications({
            recipient: userId,
            'sender.id': requesterId,
            type: 'follow_request'
        }, { status: 'accepted', read: true });

        res.status(200).json({ message: 'Accepted' });
    } catch { res.status(500).json({ message: 'Failed to accept request' }); }
});

router.post('/follow-request/cancel', verifyToken, async (req, res) => {
    try {
        const { targetUserId } = req.body;
        const loggedUserId = req.userId;

        if (!targetUserId) return res.status(400).json({ message: 'Target user ID required' });

        // Remove loggedUserId from targetUserId's followRequests
        await User.findByIdAndUpdate(targetUserId, { $pull: { followRequests: loggedUserId } });
        // Remove any pending follow request notification
        await require('../lib/notification.js').deleteNotifications({
            recipient: targetUserId,
            'sender.id': loggedUserId,
            type: 'follow_request'
        });
        res.status(200).json({ message: 'Request cancelled' });
    } catch { res.status(500).json({ message: 'Failed to cancel request' }); }
});

router.post('/follow-request/decline', verifyToken, async (req, res) => {
    try {
        const { userId, requesterId } = req.body; // userId is ME
        const loggedUserId = req.userId;

        if (String(userId) !== String(loggedUserId)) {
            return res.status(403).json({ message: 'Unauthorized.' });
        }
        await User.findByIdAndUpdate(userId, { $pull: { followRequests: requesterId } });
        // Mark the follow request notification as declined
        const me = await User.findById(userId).select('fullname profile_picture');
        await require('../lib/notification.js').updateNotifications({
            recipient: userId,
            'sender.id': requesterId,
            type: 'follow_request'
        }, { status: 'rejected', read: true });

        // Notify the requester that their request was declined
        await require('../lib/notification.js').createNotification({
            recipientId: requesterId,
            sender: { id: userId, fullname: me.fullname, profile_picture: me.profile_picture },
            type: 'follow_decline',
        });
        res.status(200).json({ message: 'Declined' });
    } catch { res.status(500).json({ message: 'Failed to decline request' }); }
});

router.get('/user/:id', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select(OTHER_USER_EXCLUSIONS);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/followers/:userId', verifyToken, async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.userId).select('followers isPrivate');
        if (!targetUser) return res.status(404).json({ message: 'User not found' });

        // Privacy check: If private, only owner or followers can see the list
        const isOwner = req.params.userId === req.userId;
        const isFollower = targetUser.followers.includes(req.userId);

        if (targetUser.isPrivate && !isOwner && !isFollower) {
            return res.status(403).json({ message: 'This account is private' });
        }

        res.status(200).json(targetUser.followers || []);
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/following/:userId', verifyToken, async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.userId).select('following followers isPrivate');
        if (!targetUser) return res.status(404).json({ message: 'User not found' });

        // Privacy check: If private, only owner or followers can see the list
        const isOwner = req.params.userId === req.userId;
        const isFollower = targetUser.followers.includes(req.userId);

        if (targetUser.isPrivate && !isOwner && !isFollower) {
            return res.status(403).json({ message: 'This account is private' });
        }

        res.status(200).json(targetUser.following || []);
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.all("/search", async (req, res) => {
    const query = req.method === 'GET' ? req.query.query : req.body.query;
    if (!query) return res.status(400).json({ message: "Search query is required." });

    try {
        // Try to get userId from token if present (optional search context)
        let requesterId = null;
        try {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                const hashedToken = hashValue(token);
                const session = await LoginSession.findOne({ accessToken: hashedToken });
                if (session && !session.isRevoked && session.expiresAt > new Date()) {
                    requesterId = session.userId;
                }
            }
        } catch (e) { /* ignore invalid tokens for public search */ }

        // Escape special regex characters to prevent crashes
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const normalizedQuery = escapedQuery.startsWith('@') ? escapedQuery.slice(1) : escapedQuery;

        const userResults = await User.find({
            $or: [
                { fullname: { $regex: escapedQuery, $options: "i" } },
                { username: { $regex: normalizedQuery, $options: "i" } }
            ]
        }).select('fullname username profile_picture bio isPrivate isVerified creatorTier isOnline followers following followRequests')
            .limit(20)
            .lean();

        const usersWithCounts = userResults.map(u => ({
            _id: u._id,
            fullname: u.fullname,
            username: u.username,
            profile_picture: u.profile_picture,
            isVerified: u.isVerified,
            creatorTier: u.creatorTier,
            followerCount: (u.followers || []).length,
            hasPendingRequest: (u.followRequests || []).some(id => id.toString() === requesterId?.toString())
        }));

        const postResults = await Post.find({ category: { $regex: escapedQuery, $options: "i" } }).limit(20).lean();

        // If it's a GET request from certain parts of the app (like NewPost) that might expect just an array of users,
        // we should still return the full object, but I'll check if I need to adjust.
        // Actually, let's just return the full object as it is more consistent.
        res.status(200).json({ users: usersWithCounts, posts: postResults });
    } catch (error) {
        logger.error(`Search error for query "${query}":`, error);
        res.status(500).json({ message: "Internal server error." });
    }
});

// ─── NOTIFICATION SETTINGS ───────────────────────────────────────────────────
router.get('/notification-settings', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('notificationSettings').lean();
        res.json(user?.notificationSettings || { emailDigest: false, pushEnabled: true });
    } catch { res.status(500).json({ message: 'Internal server error' }); }
});

router.patch('/notification-settings', verifyToken, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.userId, { notificationSettings: req.body }, { new: true }).select('notificationSettings').lean();
        res.json(user.notificationSettings);
    } catch { res.status(500).json({ message: 'Internal server error' }); }
});

const adminAlertCooldowns = new Map();

// ─── VERIFY PASSWORD (for admin re-auth gate) ────────────────────────────────
router.post('/verify-password', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('+password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Google/OAuth users have no password
        if (!user.password) return res.status(400).json({ message: 'Password login not available for this account' });

        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) {
            // Rate limiting: max 1 email per 5 minutes per user
            const now = Date.now();
            const lastSent = adminAlertCooldowns.get(req.userId) || 0;
            if (now - lastSent > 5 * 60 * 1000) {
                adminAlertCooldowns.set(req.userId, now);

                const ip = getIp(req);
                const device = parseDevice(req.headers['user-agent']);

                // Find all admins
                const admins = await User.find({ isAdmin: true }).select('email fullname');

                admins.forEach(admin => {
                    sendEmail({
                        to: admin.email,
                        subject: '🚨 Security Alert: Admin Password Failure',
                        html: `
                        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;border:1px solid #f3f4f6;border-radius:16px">
                            <h2 style="color:#ef4444;margin-top:0">⚠️ Admin Panel Security Alert</h2>
                            <p>An incorrect password was entered on the <strong>Admin Control Panel</strong>.</p>
                            <div style="background:#f9fafb;padding:16px;border-radius:12px;margin:20px 0;font-size:14px">
                                <p style="margin:0 0 8px"><strong>Attempted By (User ID):</strong> ${user._id} (${user.fullname})</p>
                                <p style="margin:0 0 8px"><strong>IP Address:</strong> ${ip}</p>
                                <p style="margin:0 0 8px"><strong>Device:</strong> ${device}</p>
                                <p style="margin:0"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                            </div>
                            <p style="color:#ef4444;font-weight:bold">If this wasn't you, someone may be trying to access the Admin Control Panel.</p>
                            <p style="color:#6b7280;font-size:12px;margin-top:20px">This is an automated security alert from Social Square.</p>
                        </div>`
                    }).catch(err => console.error(`[Security] Failed to send admin alert email to ${admin.email}:`, err.message));
                });
            }
            return res.status(401).json({ message: 'Incorrect password' });
        }

        res.status(200).json({ message: 'Verified' });
    } catch (err) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// ─── BLOCK / MUTE USER ────────────────────────────────────────────────────────
router.post('/block', verifyToken, async (req, res) => {
    try {
        const { targetUserId } = req.body;
        if (!targetUserId) return res.status(400).json({ error: 'Target user ID required' });
        if (targetUserId === req.userId) return res.status(400).json({ error: 'Cannot block yourself' });

        await User.findByIdAndUpdate(req.userId, { $addToSet: { blockedUsers: targetUserId } });
        // Also unfollow automatically when blocking
        await User.findByIdAndUpdate(req.userId, { $pull: { following: targetUserId } });
        await User.findByIdAndUpdate(targetUserId, { $pull: { followers: req.userId } });

        res.status(200).json({ message: 'User blocked' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/unblock', verifyToken, async (req, res) => {
    try {
        const { targetUserId } = req.body;
        await User.findByIdAndUpdate(req.userId, { $pull: { blockedUsers: targetUserId } });
        res.status(200).json({ message: 'User unblocked' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/mute', verifyToken, async (req, res) => {
    try {
        const { targetUserId } = req.body;
        await User.findByIdAndUpdate(req.userId, { $addToSet: { mutedUsers: targetUserId } });
        res.status(200).json({ message: 'User muted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── CREATOR ANALYTICS (PROTECTED) ──────────────────────────────────────────
router.get('/analytics/:userId', verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const loggedUserId = req.userId;

        if (userId !== loggedUserId.toString()) return res.status(403).json({ message: "Unauthorized." });

        const posts = await Post.find({ "user._id": userId }).lean();

        const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0);
        const totalLikes = posts.reduce((sum, p) => sum + (p.likes?.length || 0), 0);
        const totalComments = posts.reduce((sum, p) => sum + (p.comments?.length || 0), 0);
        const totalPosts = posts.length;

        // Engagement Rate = (Likes + Comments) / Views (simplified)
        const engagementRate = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;

        const topPosts = posts
            .sort((a, b) => (b.views || 0) - (a.views || 0))
            .slice(0, 5)
            .map(p => ({
                id: p._id,
                views: p.views || 0,
                likes: p.likes?.length || 0,
                comments: p.comments?.length || 0,
                image: p.image_urls?.[0] || p.image_url,
                caption: p.caption
            }));

        res.status(200).json({
            stats: {
                totalViews,
                totalLikes,
                totalComments,
                totalPosts,
                engagementRate: engagementRate.toFixed(2)
            },
            topPosts
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
