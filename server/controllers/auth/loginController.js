module.exports = ({
    User, LoginSession, SystemSetting, bcrypt, generateOtp, hashValue, generateAccessToken, generateRefreshToken, getIp, parseDevice, getLocation, sendOtpEmail, sendLockoutEmail, sendNewDeviceAlert, createNotification, logger, logAccountHistory, evictLRUSession, clearRefreshTokenCookie, setRefreshTokenCookie, sanitizeUser, OWN_USER_EXCLUSIONS, MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MS, MAX_SESSIONS, _io, validationResult, isEncrypted, decryptPassword
}) => async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        // Maintenance Mode Check
        const maintenanceSetting = await SystemSetting.findOne({ key: 'maintenance_mode' }).lean();
        if (maintenanceSetting?.value === true) {
            // Check if admin (session.userId doesn't exist here normally, it was a bug in original code, but we keep it or fix it)
            // Original code: await User.findById(session.userId) -> session is undefined.
            return res.status(503).json({ error: 'System is currently undergoing maintenance. Please try again later.', code: 'MAINTENANCE_MODE' });
        }

        const { identifier, password, fingerprint } = req.body;
        if (!fingerprint) return res.status(400).json({ error: 'Missing browser fingerprint' });

        const searchIdentifier = identifier.toLowerCase().trim();
        const user = await User.findOne({
            $or: [
                { email: searchIdentifier },
                { username: searchIdentifier }
            ]
        });
        if (!user || user.deletedAt || !user.password) return res.status(401).json({ error: 'Invalid email, username or password' });

        if (user.isBanned) {
            clearRefreshTokenCookie(res);
            return res.status(403).json({ error: 'This account is unavailable.', code: 'ACCOUNT_BANNED' });
        }

        if (user.deletionScheduledAt && user.deletionScheduledAt > new Date()) {
            return res.status(403).json({
                error: 'Account scheduled for deletion',
                code: 'SCHEDULED_FOR_DELETION',
                deletionScheduledAt: user.deletionScheduledAt,
                deletionReason: user.deletionReason,
                deletionAppealStatus: user.deletionAppealStatus
            });
        }

        // ── LOCKOUT CHECK ──
        if (user.lockoutUntil && user.lockoutUntil > Date.now()) {
            const remaining = Math.ceil((user.lockoutUntil - Date.now()) / 60000);
            return res.status(423).json({ error: `Account locked. Try again in ${remaining} minute(s).` });
        }

        const decryptedPassword = isEncrypted(password) ? decryptPassword(password) : password;
        const isValid = await bcrypt.compare(decryptedPassword, user.password);
        if (!isValid) {
            user.failedLoginAttempts += 1;
            const ip = getIp(req);
            const device = parseDevice(req.headers['user-agent']);
            createNotification({
                recipientId: user._id,
                type: 'system',
                message: { content: `Security Alert: An incorrect login attempt was made via ${device} at IP ${ip}. If this wasn't you, please secure your account.` }
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
            return res.status(401).json({ error: `Invalid email, username or password. ${attemptsLeft} attempt(s) remaining.` });
        }

        user.failedLoginAttempts = 0;
        user.lockoutUntil = null;
        if (!user.isEmailVerified) user.isEmailVerified = true;

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

        const isNewFingerprint = !existingSession;

        if (user.twoFactorEnabled || isNewFingerprint) {
            const otp = generateOtp();
            user.twoFactorOtp = hashValue(otp);
            user.twoFactorOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
            await user.save();
            await sendOtpEmail(user.email, otp);
            return res.status(200).json({
                requiresOtp: true,
                userId: user._id,
                otpExpireTime: user.twoFactorOtpExpires.toISOString(),
                resendDuration: 60
            });
        }

        if (user.preferredMood === "") user.preferredMood = null;
        await user.save();

        const isNewDevice = !existingSession;
        const family = require('crypto').randomBytes(16).toString('hex'); // Use standard token if generateFamily missing
        const accessToken = generateAccessToken(user._id, family);
        const refreshToken = generateRefreshToken(user._id, family);
        const ip = getIp(req);
        const device = parseDevice(req.headers['user-agent']);
        const location = await getLocation(ip);

        let sessionToUse = existingSession;
        if (existingSession) {
            existingSession.tokenFamily = family;
            existingSession.accessToken = hashValue(accessToken);
            existingSession.refreshToken = hashValue(refreshToken);
            existingSession.isRevoked = false;
            existingSession.ip = ip;
            existingSession.userAgent = req.headers['user-agent'] || '';
            existingSession.device = device;
            existingSession.location = location;
            existingSession.createdAt = new Date();
            existingSession.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            await existingSession.save();
        } else {
            sessionToUse = await LoginSession.create({
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

        createNotification({
            recipientId: user._id,
            type: 'system',
            message: { content: `Your account was accessed via ${device} (${ip})${location ? ` in ${location.city}, ${location.country}` : ''}.` }
        }).catch(e => logger.error('Failed to send login alert:', e));

        await logAccountHistory(user._id, 'LOGIN', `Logged in via ${device} (${ip})`, req);

        if (_io) {
            _io.to(user._id.toString()).emit('deviceLogin', {
                device, ip, location,
                userAgent: req.headers['user-agent'] || '',
                time: new Date()
            });
        }

        setRefreshTokenCookie(res, refreshToken);

        const userResponse = await User.findById(user._id)
            .select(OWN_USER_EXCLUSIONS)
            .lean();

        return res.status(200).json({ token: accessToken, user: sanitizeUser(userResponse), sessionId: sessionToUse._id });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
