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
const softVerifyToken = require('../middleware/softVerifyToken');
const AuditLog = require('../models/AuditLog');
const authRateLimiter = require('../middleware/authRateLimiter');
const { propagateUserProfileUpdate } = require('../utils/userPropagation');
const admin = require('firebase-admin');

// ─── FIREBASE ADMIN INITIALIZATION ───────────────────────────────────────────
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'social-square-official'
    });
}


const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const MAX_SESSIONS = 10;

// ─── LRU SESSION EVICTION ─────────────────────────────────────────────────────
// When a user hits the session cap, silently evict their least-recently-used
// session and notify them by email instead of blocking login.
async function evictLRUSession(userId, userEmail, userName) {
    const lru = await LoginSession.findOne({ userId, isRevoked: false })
        .sort({ lastUsedAt: 1 })
        .lean();
    if (!lru) return;
    await LoginSession.updateOne({ _id: lru._id }, { isRevoked: true });
    try {
        await sendEmail({
            to: userEmail,
            subject: 'Social Square – A device was signed out',
            html: `<p>Hi ${userName},</p>
                   <p>You've reached the maximum number of active sessions. Your oldest device (<strong>${lru.device || 'Unknown device'}</strong>, last used ${new Date(lru.lastUsedAt).toUTCString()}) has been signed out automatically.</p>
                   <p>If you don't recognise this activity, please <a href="${process.env.CLIENT_URL}/settings/sessions">review your active sessions</a> immediately.</p>`,
        });
    } catch (e) {
        console.warn('[evictLRUSession] Failed to send eviction email:', e.message);
    }
}

// ─── PURGE STALE SESSIONS CRON (daily at 03:00) ───────────────────────────────
// Deletes sessions that are revoked OR expired for more than 7 days.
// This prevents DB bloat since isRevoked only flips a flag.
function startSessionCleanupJob() {
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const msUntil3am = (() => {
        const now = new Date();
        const next3am = new Date(now);
        next3am.setHours(3, 0, 0, 0);
        if (next3am <= now) next3am.setDate(next3am.getDate() + 1);
        return next3am - now;
    })();

    setTimeout(async function run() {
        try {
            const cutoff = new Date(Date.now() - SEVEN_DAYS);
            const result = await LoginSession.deleteMany({
                $or: [
                    { isRevoked: true, updatedAt: { $lt: cutoff } },
                    { expiresAt: { $lt: cutoff } },
                ]
            });
            if (result.deletedCount > 0) {
                console.log(`[SessionCleanup] Purged ${result.deletedCount} stale sessions.`);
            }
        } catch (err) {
            console.error('[SessionCleanup] Error:', err.message);
        }
        setTimeout(run, 24 * 60 * 60 * 1000); // repeat every 24 hours
    }, msUntil3am);
}
startSessionCleanupJob();


// ✅ Privacy: Standard exclusions for user responses
// For the logged-in user (OWN), we exclude security tokens but keep email/settings
const OWN_USER_EXCLUSIONS = '-password -twoFactorOtp -twoFactorOtpExpires -resetPasswordToken -resetPasswordExpires -emailVerificationToken -emailVerificationTokenSentAt -loginSessions -__v';

// For other users (OTHER), we exclude almost everything personal/sensitive
const OTHER_USER_EXCLUSIONS = '-password -email -loginSessions -notificationSettings -resetPasswordToken -resetPasswordExpires -twoFactorOtp -twoFactorOtpExpires -failedLoginAttempts -lockoutUntil -googleId -githubId -emailVerificationToken -emailVerificationTokenSentAt -dismissedUsers -__v -twoFactorEnabled -authProvider -isAdmin -isVerified -creatorTier -isBanned -banReason -bannedAt -isEmailVerified -hasSeenWelcome -savedPosts -followers -following -followRequests';

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
function sanitizeUser(user) {
    if (!user) return null;
    const sanitized = { ...user };
    sanitized.postCount = user.postsCount || 0;
    sanitized.followerCount = user.followersCount || 0;
    sanitized.followingCount = user.followingCount || 0;
    return sanitized;
}

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
        if (!user || user.deletedAt || !user.password) return res.status(401).json({ error: 'Invalid email or password' });

        if (user.isBanned) {
            return res.status(403).json({ error: user.banReason || 'Your account has been banned for violating our community guidelines.' });
        }

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

        if (isActivatingNewSession && activeSessionsCount >= MAX_SESSIONS) {
            await evictLRUSession(user._id, user.email, user.fullname);
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
            existingSession.createdAt = new Date(); // Reset hard ceiling on fresh login
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
            type: 'system',
            message: { content: `✅ New Login: Your account was accessed via ${device} (${ip})${location ? ` in ${location.city}, ${location.country}` : ''}.` }
        }).catch(e => logger.error('Failed to send login alert:', e));

        setRefreshTokenCookie(res, refreshToken);

        // Return user object so frontend can restore session without extra request
        const userResponse = await User.findById(user._id)
            .select(OWN_USER_EXCLUSIONS)
            .lean();

        return res.status(200).json({ token: accessToken, user: sanitizeUser(userResponse) });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── VERIFY OTP ───────────────────────────────────────────────────────────────

router.post('/verify-otp', authRateLimiter, [
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
            type: 'system',
            message: { content: `✅ Secure Login: Your account was accessed via ${device} (OTP verified) at IP ${ip}.` }
        }).catch(e => logger.error('Failed to send login alert:', e));

        setRefreshTokenCookie(res, refreshToken);

        // Return user object so frontend can restore session without extra request
        const userResponse = await User.findById(user._id)
            .select(OWN_USER_EXCLUSIONS)
            .lean();

        return res.status(200).json({ token: accessToken, user: sanitizeUser(userResponse) });
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

        let googleId, email, name, picture;

        try {
            // 1. Try standard Google ID Token verification
            const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
            const payload = ticket.getPayload();
            googleId = payload.sub;
            email = payload.email;
            name = payload.name;
            picture = payload.picture;
        } catch (err) {
            try {
                // 2. Try Firebase ID Token verification
                const decodedToken = await admin.auth().verifyIdToken(credential);
                googleId = decodedToken.uid;
                email = decodedToken.email;
                name = decodedToken.name;
                picture = decodedToken.picture;
            } catch (firebaseErr) {
                console.error('Google/Firebase verification failed:', err.message, firebaseErr.message);
                return res.status(401).json({ error: 'Google authentication failed' });
            }
        }


        let user = await User.findOne({ $or: [{ googleId }, { email }] });
        if (user) {
            if (user.deletedAt) return res.status(403).json({ error: 'This account has been deactivated.' });
            if (user.isBanned) return res.status(403).json({ error: user.banReason || 'This account has been banned.' });
        }

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
            existingSession.createdAt = new Date(); // Reset hard ceiling on fresh login
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

        return res.status(200).json({ token: accessToken, user: sanitizeUser(userResponse) });
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
        if (!token) return res.status(401).json({ error: 'No refresh token', code: 'NO_TOKEN' });
        if (!fingerprint) return res.status(401).json({ error: 'Missing fingerprint', code: 'MISSING_FINGERPRINT' });

        const hashedToken = hashValue(token);
        const session = await LoginSession.findOne({ refreshToken: hashedToken });
        if (!session) return res.status(401).json({ error: 'Session not found', code: 'SESSION_NOT_FOUND' });

        if (session.isRevoked) return res.status(401).json({ error: 'Session revoked', code: 'SESSION_REVOKED' });
        if (session.expiresAt < new Date()) return res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' });

        // Fingerprint check
        if (session.fingerprint !== hashValue(fingerprint)) {
            console.warn(`[SECURITY] Fingerprint mismatch for user ${session.userId}`);
            return res.status(401).json({ error: 'Browser fingerprint mismatch', code: 'FINGERPRINT_MISMATCH' });
        }

        // Enforce a hard absolute ceiling of 90 days for any session
        const MAX_SESSION_LIFETIME = 90 * 24 * 60 * 60 * 1000; // 90 days
        const hardExpiryTime = session.createdAt.getTime() + MAX_SESSION_LIFETIME;

        if (Date.now() > hardExpiryTime) {
            return res.status(401).json({ error: 'Session reached absolute maximum lifetime (90 days). Please log in again.', code: 'HARD_CEILING' });
        }

        const newAccessToken = generateAccessToken(session.userId, session.tokenFamily);
        const newRefreshToken = generateRefreshToken(session.userId, session.tokenFamily);

        const newExpiresAt = new Date(Math.min(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
            hardExpiryTime
        ));

        await LoginSession.findByIdAndUpdate(session._id, {
            accessToken: hashValue(newAccessToken),
            refreshToken: hashValue(newRefreshToken),
            lastUsedAt: new Date(),
            expiresAt: newExpiresAt,
        });

        setRefreshTokenCookie(res, newRefreshToken);

        const user = await User.findById(session.userId)
            .select(OWN_USER_EXCLUSIONS)
            .lean();

        return res.status(200).json({ token: newAccessToken, user: sanitizeUser(user) });
    } catch (error) {
        console.error('Refresh error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
router.post('/logout', verifyToken, async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (token) {
            await LoginSession.findOneAndUpdate(
                { refreshToken: hashValue(token), userId: req.userId },
                { isRevoked: true, accessToken: null, refreshToken: null }
            );
        }
        // Also revoke current session
        if (req.sessionId) {
            await LoginSession.findByIdAndUpdate(req.sessionId, { isRevoked: true, accessToken: null, refreshToken: null });
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
                device: session.device,
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

router.post('/forgot-password', authRateLimiter, [body('email').isEmail()], async (req, res) => {
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

router.post('/reset-password', authRateLimiter, [body('token').notEmpty(), body('email').isEmail(), body('password').isLength({ min: 6, max: 128 })], async (req, res) => {
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
        const user = await User.findById(req.userId).select(OWN_USER_EXCLUSIONS).lean();
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const postCount = await Post.countDocuments({ owner: req.userId });
        return res.status(200).json({ ...user, postCount });
    } catch (error) {
        logger.error('[GET_USER] Unexpected error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// ─── OWN PROFILE (Token-resolved — Race-condition-free) ───────────────────────
// No URL params needed. Identity is resolved entirely from the JWT via verifyToken.
// This is the only endpoint the Profile component should call for the own-profile view.
router.get('/me', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId).select(OWN_USER_EXCLUSIONS).lean();
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const postCount = await Post.countDocuments({ 'user._id': userId, deletedAt: null });

        return res.status(200).json({
            ...user,
            postCount,
            isOwner: true, // Explicit flag so frontend never needs to infer ownership
        });
    } catch (error) {
        logger.error('[ME] Error:', error);
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
            .select('fullname username profile_picture bio isPrivate followers following level streak xp profileViews isOnline followRequests blockedUsers postsCount followersCount followingCount')
            .lean();

        if (!targetUser) return res.status(404).json({ message: 'User not found.' });

        const postCount = targetUser.postsCount || 0;

        const loggedUser = await User.findById(loggedUserId)
            .select('following followers blockedUsers')
            .lean();

        const isFollowing = (loggedUser?.following || []).some(id => id.toString() === targetId.toString());

        // Filter out expired follow requests (e.g., 30 days)
        const EXPIRY_DAYS = 30;
        const now = new Date();
        const validRequests = (targetUser.followRequests || []).filter(r => {
            if (!r.requestedAt) return true;
            const ageDays = (now - new Date(r.requestedAt)) / (1000 * 60 * 60 * 24);
            return ageDays <= EXPIRY_DAYS;
        });

        const hasPendingRequest = validRequests.some(r => r.userId?.toString() === loggedUserId.toString());

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
        const isOwner = loggedUserId.equals(targetId);
        const canSeeDetails = isOwner || isFollowing || !targetUser.isPrivate;

        const isBlockedByMe = (loggedUser?.blockedUsers || []).some(id => id.toString() === targetId.toString());
        const isBlockingMe = (targetUser.blockedUsers || []).some(id => id.toString() === loggedUserId.toString());

        return res.status(200).json({
            ...targetUser,
            followers: canSeeDetails ? targetUser.followers : [],
            following: canSeeDetails ? targetUser.following : [],
            followerCount: targetUser.followersCount || 0,
            followingCount: targetUser.followingCount || 0,
            postCount: canSeeDetails ? postCount : "Private",
            isFollowing,
            isBlockedByMe,
            isBlockingMe,
            hasPendingRequest,
            followRequests: isOwner ? validRequests : undefined, // Only owner sees valid requests
            mutualFollowers: mutualDetails,
            mutualCount: mutualIds.length,
        });
    } catch (error) {
        logger.error('[OTHER_USER_VIEW] Error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// ─── PUBLIC USER PROFILE VIEW (Logged-out) ────────────────────────────────────
router.get('/public/profile/:identifier', softVerifyToken, async (req, res) => {
    try {
        const viewerId = req.userId;
        const identifier = req.params.identifier;
        let query = {};

        if (mongoose.Types.ObjectId.isValid(identifier)) {
            query = { _id: identifier };
        } else {
            query = { username: identifier };
        }

        const user = await User.findOne(query)
            .select('fullname username profile_picture bio isPrivate followers following level streak xp profileViews postsCount followersCount followingCount')
            .lean();

        if (!user) return res.status(404).json({ message: 'User not found.' });

        const postCount = user.postsCount || 0;

        // Set cache headers for aggressive CDN caching (5 minutes)
        res.setHeader('Cache-Control', 'public, max-age=300');

        // Privacy: if private, only allow visibility if owner or following
        let canSeeCount = !user.isPrivate;
        if (!canSeeCount && viewerId) {
            const isFollowing = (user.followers || []).some(id => id.toString() === viewerId.toString());
            const isOwner = viewerId.toString() === user._id.toString();
            if (isFollowing || isOwner) canSeeCount = true;
        }

        return res.status(200).json({
            _id: user._id,
            fullname: user.fullname,
            username: user.username,
            profile_picture: user.profile_picture,
            bio: user.bio,
            isPrivate: user.isPrivate,
            followerCount: user.followersCount || 0,
            followingCount: user.followingCount || 0,
            postCount: canSeeCount ? postCount : "Private",
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
        if (ids.length > 100) return res.status(400).json({ error: 'Too many IDs. Max 100.' });
        const users = await User.find({ _id: { $in: ids } }).select('fullname username profile_picture').lean();
        res.status(200).json({ users });
    } catch (e) {
        logger.error('[USERS_DETAILS] Error:', e.message);
        res.status(500).json({ error: 'Failed to fetch user details' });
    }
});

router.put('/update-profile', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { fullname, username, email, profile_picture, bio, preferredMood, isPrivate } = req.body;

        if (username) {
            const exists = await User.findOne({ username, _id: { $ne: userId } });
            if (exists) return res.status(400).json({ message: 'Username is already taken.' });
        }

        const updateData = { fullname, username, email, profile_picture, bio, preferredMood };
        if (typeof isPrivate === 'boolean') {
            const userBefore = await User.findById(userId).select('isPrivate').lean();
            if (userBefore && userBefore.isPrivate !== isPrivate) {
                updateData.isPrivate = isPrivate;
                await AuditLog.create({
                    userId,
                    action: 'privacy_toggle',
                    metadata: { oldValue: userBefore.isPrivate, newValue: isPrivate },
                    ip: getIp(req),
                    userAgent: req.headers['user-agent']
                });
            }
        }

        let privacyWarning = null;
        const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true }).select(OWN_USER_EXCLUSIONS);
        if (!updatedUser) return res.status(404).json({ message: 'User not found.' });

        // If user just switched to private, provide a warning about existing followers (Risk 4)
        if (updateData.isPrivate === true) {
            const followerCount = updatedUser.followersCount || 0;
            if (followerCount > 0) {
                privacyWarning = `Your account is now private. Note that your ${followerCount} existing followers still have access to your content.`;
            }
        }

        // ✅ Propagate changes to denormalized collections (Posts, Comments, etc.)
        if (fullname || profile_picture || username) {
            propagateUserProfileUpdate(userId, { fullname, username, profile_picture }).catch(err => {
                console.error(`[Propagation Error] for user ${userId}:`, err.message);
            });
        }

        res.status(200).json({
            user: updatedUser,
            privacyWarning
        });
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
        const { followUserId } = req.body;
        const userId = req.userId; // Use userId from token

        const targetUser = await User.findById(followUserId).select('isPrivate followers followRequests followersCount');
        if (!targetUser) return res.status(404).json({ message: 'Target user not found' });

        // If target is private, add to followRequests instead of followers
        if (targetUser.isPrivate) {
            // Already following?
            if (targetUser.followers?.includes(userId)) return res.status(200).json({
                _id: followUserId,
                requested: false,
                alreadyFollowing: true,
                followerCount: targetUser.followersCount || 0
            });

            // Already requested?
            if (targetUser.followRequests?.some(r => r.userId?.toString() === userId.toString())) return res.status(200).json({
                _id: followUserId,
                requested: true,
                alreadyRequested: true,
                followRequestsCount: targetUser.followRequests?.length || 0
            });

            const updatedTarget = await User.findByIdAndUpdate(
                followUserId,
                { $addToSet: { followRequests: { userId, requestedAt: new Date() } } },
                { new: true }
            ).select('followersCount followRequests');

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
                hasPendingRequest: true,
                isPrivate: true,
                followerCount: updatedTarget.followersCount || 0,
            });
        }

        // Public account logic
        await User.findByIdAndUpdate(userId, { $addToSet: { following: followUserId }, $inc: { followingCount: 1 } });
        const user = await User.findByIdAndUpdate(followUserId, { $addToSet: { followers: userId }, $inc: { followersCount: 1 } }, { new: true }).select('followersCount followingCount');

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
            hasPendingRequest: false,
            isFollowing: true,
            followerCount: user.followersCount || 0,
            followingCount: user.followingCount || 0
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
        await User.findByIdAndUpdate(meId, { $pull: { following: targetId }, $inc: { followingCount: -1 } });
        const updatedTarget = await User.findByIdAndUpdate(
            targetId,
            { $pull: { followers: meId }, $inc: { followersCount: -1 } },
            { new: true }
        ).select(OTHER_USER_EXCLUSIONS);

        res.status(200).json({
            _id: targetId,
            followerCount: updatedTarget?.followersCount || 0
        });
    } catch (error) {
        console.error('[UNFOLLOW]', error);
        res.status(500).json({ message: 'Failed to unfollow user.' });
    }
});

// ─── REMOVE FOLLOWER (PROTECTED) ──────────────────────────────────────────────
// Allows a user to remove someone from their followers list (silent)
router.post('/remove-follower', verifyToken, async (req, res) => {
    try {
        const { followerId } = req.body;
        const userId = req.userId; // ME

        if (!followerId) return res.status(400).json({ message: 'Follower ID required' });

        // 1. Remove follower from MY followers list
        const me = await User.findByIdAndUpdate(userId, {
            $pull: { followers: followerId },
            $inc: { followersCount: -1 }
        }, { new: true });

        // 2. Remove ME from the other user's following list
        if (me) {
            await User.findByIdAndUpdate(followerId, {
                $pull: { following: userId },
                $inc: { followingCount: -1 }
            });
        }

        res.status(200).json({ message: 'Follower removed', followerCount: me?.followersCount || 0 });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
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
            $pull: { followRequests: { userId: requesterId } },
            $addToSet: { followers: requesterId },
            $inc: { followersCount: 1 }
        });

        // Also update the requester's following list
        await User.findByIdAndUpdate(requesterId, {
            $addToSet: { following: userId },
            $inc: { followingCount: 1 }
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
        res.status(200).json({
            message: 'Request cancelled',
            hasPendingRequest: false,
            requested: false
        });
    } catch { res.status(500).json({ message: 'Failed to cancel request' }); }
});

router.post('/follow-request/decline', verifyToken, async (req, res) => {
    try {
        const { userId, requesterId } = req.body; // userId is ME
        const loggedUserId = req.userId;

        if (String(userId) !== String(loggedUserId)) {
            return res.status(403).json({ message: 'Unauthorized.' });
        }
        await User.findByIdAndUpdate(userId, { $pull: { followRequests: { userId: requesterId } } });
        // Mark the follow request notification as declined
        await require('../lib/notification.js').updateNotifications({
            recipient: userId,
            'sender.id': requesterId,
            type: 'follow_request'
        }, { status: 'rejected', read: true });

        // Decline is silent (no notification sent to requester)
        res.status(200).json({ message: 'Declined' });
    } catch { res.status(500).json({ message: 'Failed to decline request' }); }
});



router.get('/user/:id', verifyToken, async (req, res) => {
    try {
        const targetId = req.params.id;
        const loggedUserId = req.userId;

        // 1. Fetch user with standard exclusions + lists for logic
        const targetUser = await User.findById(targetId).lean();
        if (!targetUser) return res.status(404).json({ message: 'User not found' });

        const loggedUser = await User.findById(loggedUserId).select('blockedUsers following').lean();

        const isBlockedByMe = (loggedUser?.blockedUsers || []).some(id => id.toString() === targetId);
        const isBlockingMe = (targetUser.blockedUsers || []).some(id => id.toString() === loggedUserId.toString());
        const hasPendingRequest = (targetUser.followRequests || []).some(r => r.userId?.toString() === loggedUserId.toString());
        const isFollowing = (loggedUser?.following || []).some(id => id.toString() === targetId);

        // 3. Privacy: Only show lists if followed or self
        const canSeeDetails = isFollowing || loggedUserId.toString() === targetId || !targetUser.isPrivate;

        const responseUser = { ...targetUser };
        // Map denormalized counts for frontend
        responseUser.postCount = canSeeDetails ? (targetUser.postsCount || 0) : 0;
        responseUser.followerCount = targetUser.followersCount || 0;
        responseUser.followingCount = targetUser.followingCount || 0;

        // Strip sensitive data and large arrays
        const exclusions = OTHER_USER_EXCLUSIONS.split(' ').map(e => e.startsWith('-') ? e.slice(1) : e);
        exclusions.forEach(field => delete responseUser[field]);

        if (!canSeeDetails) {
            delete responseUser.followers;
            delete responseUser.following;
            delete responseUser.followRequests;
        } else {
            // Even if they can see, we usually don't want to send thousands of IDs in the basic view
            // The frontend should call /followers/:id or /following/:id to get the list
            responseUser.followers = targetUser.followers?.slice(0, 10) || [];
            responseUser.following = targetUser.following?.slice(0, 10) || [];
        }

        res.status(200).json({
            ...responseUser,
            isBlockedByMe,
            isBlockingMe,
            hasPendingRequest,
            isFollowing
        });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/followers/:userId', verifyToken, async (req, res) => {
    try {
        const { limit = 10, cursor } = req.query;
        const parsedLimit = parseInt(limit);

        // 1. Get the total count and isPrivate status first
        const userMeta = await User.findById(req.params.userId).select('followersCount isPrivate followers').lean();
        if (!userMeta) return res.status(404).json({ message: 'User not found' });

        // Privacy check
        const isOwner = req.params.userId.toString() === req.userId.toString();
        // Since we didn't fetch all followers, we need a separate check or use the meta we have
        const isFollower = (userMeta.followers || []).some(id => id.toString() === req.userId.toString());

        if (userMeta.isPrivate && !isOwner && !isFollower) {
            return res.status(403).json({ message: 'This account is private' });
        }

        const totalFollowers = userMeta.followers || [];
        let startIndex = 0;
        if (cursor) {
            const index = totalFollowers.findIndex(id => id.toString() === cursor);
            if (index !== -1) startIndex = index + 1;
        }

        // 2. Fetch only the IDs we need using slice (already done via array slice above, 
        // but we can optimize by only selecting the slice in the query if we don't need the whole array for index lookup)
        // However, since we need to find the index of the cursor, we might still need the whole array unless we use a different cursor strategy.
        // For now, let's keep the slice logic but make it more explicit.

        const paginatedIds = totalFollowers.slice(startIndex, startIndex + parsedLimit);
        const hasMore = startIndex + parsedLimit < totalFollowers.length;
        const nextCursor = hasMore ? paginatedIds[paginatedIds.length - 1] : null;

        const users = await User.find({ _id: { $in: paginatedIds } })
            .select('fullname username profile_picture bio isPrivate followRequests')
            .lean();

        const orderedUsers = paginatedIds.map(id => users.find(u => u._id.toString() === id.toString())).filter(Boolean);

        res.status(200).json({
            users: orderedUsers,
            nextCursor,
            hasMore,
            total: userMeta.followersCount || totalFollowers.length
        });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/following/:userId', verifyToken, async (req, res) => {
    try {
        const { limit = 10, cursor } = req.query;
        const parsedLimit = parseInt(limit);

        const targetUser = await User.findById(req.params.userId).select('following followers isPrivate').lean();
        if (!targetUser) return res.status(404).json({ message: 'User not found' });

        // Privacy check
        const isOwner = req.params.userId.toString() === req.userId.toString();
        const isFollower = (targetUser.followers || []).some(id => id.toString() === req.userId.toString());

        if (targetUser.isPrivate && !isOwner && !isFollower) {
            return res.status(403).json({ message: 'This account is private' });
        }

        const following = targetUser.following || [];
        let startIndex = 0;
        if (cursor) {
            const index = following.findIndex(id => id.toString() === cursor);
            if (index !== -1) startIndex = index + 1;
        }

        const paginatedIds = following.slice(startIndex, startIndex + parsedLimit);
        const hasMore = startIndex + parsedLimit < following.length;
        const nextCursor = hasMore ? paginatedIds[paginatedIds.length - 1] : null;

        const users = await User.find({ _id: { $in: paginatedIds } })
            .select('fullname username profile_picture bio isPrivate followRequests')
            .lean();

        const orderedUsers = paginatedIds.map(id => users.find(u => u._id.toString() === id.toString())).filter(Boolean);

        res.status(200).json({
            users: orderedUsers,
            nextCursor,
            hasMore,
            total: following.length
        });
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
        }).select('fullname username profile_picture bio isPrivate isVerified creatorTier isOnline followersCount followingCount postsCount followRequests')
            .limit(20)
            .lean();

        // Efficiently fetch post counts for all users in one go
        const userIds = userResults.map(u => u._id);
        const postCounts = await Post.aggregate([
            { $match: { owner: { $in: userIds } } },
            { $group: { _id: "$owner", count: { $sum: 1 } } }
        ]);

        const postCountMap = postCounts.reduce((acc, curr) => {
            acc[curr._id.toString()] = curr.count;
            return acc;
        }, {});

        const usersWithCounts = userResults.map(u => {
            const isOwner = requesterId && requesterId.toString() === u._id.toString();
            const isFollower = requesterId && (u.followers || []).some(id => id.toString() === requesterId.toString());
            const canSeeCount = !u.isPrivate || isOwner || isFollower;

            return {
                _id: u._id,
                fullname: u.fullname,
                username: u.username,
                profile_picture: u.profile_picture,
                isVerified: u.isVerified,
                creatorTier: u.creatorTier,
                followerCount: u.followersCount || 0,
                followingCount: u.followingCount || 0,
                postCount: canSeeCount ? (u.postsCount || 0) : "Private", // Fix Risk 1
                isPrivate: u.isPrivate,
                hasPendingRequest: (u.followRequests || []).some(id => id.toString() === requesterId?.toString())
            };
        });

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
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post('/unblock', verifyToken, async (req, res) => {
    try {
        const { targetUserId } = req.body;
        await User.findByIdAndUpdate(req.userId, { $pull: { blockedUsers: targetUserId } });
        res.status(200).json({ message: 'User unblocked' });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post('/mute', verifyToken, async (req, res) => {
    try {
        const { targetUserId } = req.body;
        await User.findByIdAndUpdate(req.userId, { $addToSet: { mutedUsers: targetUserId } });
        res.status(200).json({ message: 'User muted' });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post('/unmute', verifyToken, async (req, res) => {
    try {
        const { targetUserId } = req.body;
        await User.findByIdAndUpdate(req.userId, { $pull: { mutedUsers: targetUserId } });
        res.status(200).json({ message: 'User unmuted' });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
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
        res.status(500).json({ error: "Internal Server Error" });
    }
});


// ─── GET FOLLOW REQUESTS (PROTECTED) ─────────────────────────────────────────
router.get('/follow-requests', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).populate('followRequests.userId', 'fullname username profile_picture');
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Filter out requests older than 30 days (Risk 3: Expiry)
        const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const validRequests = (user.followRequests || []).filter(req => {
            return (now - new Date(req.requestedAt).getTime()) < THIRTY_DAYS;
        });

        // Optionally update the DB to remove expired ones (lazy cleanup)
        if (validRequests.length !== user.followRequests.length) {
            user.followRequests = validRequests;
            await user.save();
        }

        res.status(200).json(validRequests);
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
