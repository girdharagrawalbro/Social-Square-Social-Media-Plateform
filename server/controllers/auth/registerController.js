module.exports = ({
    User, LoginSession, bcrypt, generateOtp, hashValue, generateAccessToken, generateRefreshToken, getIp, parseDevice, getLocation, sendWelcomeEmail, sendOtpEmail, logger, generateUniqueUsername, setRefreshTokenCookie, OWN_USER_EXCLUSIONS, validationResult, isEncrypted, decryptPassword
}) => async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { fullname, email, password, fingerprint } = req.body;
        if (!fingerprint) return res.status(400).json({ error: 'Missing browser fingerprint' });

        const decryptedPassword = isEncrypted(password) ? decryptPassword(password) : password;
        const existing = await User.findOne({ email: email.toLowerCase().trim() });
        if (existing) return res.status(400).json({ message: 'User already exists with this email.' });

        const hashedPassword = await bcrypt.hash(decryptedPassword, 10);

        const username = await generateUniqueUsername(fullname);

        const newUser = new User({
            fullname: fullname.trim(),
            username,
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            authProvider: 'local',
            isEmailVerified: false,
        });

        const verificationOtp = generateOtp();
        newUser.emailVerificationOtp = hashValue(verificationOtp);
        newUser.emailVerificationOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
        await newUser.save();

        // Send welcome email
        sendWelcomeEmail(newUser.email, newUser.fullname).catch(err => logger.error('[SIGNUP] Welcome email failed:', err));

        // Send verification OTP email
        sendOtpEmail(newUser.email, verificationOtp).catch(err => logger.error('[SIGNUP] Verification OTP failed:', err));

        const family = require('crypto').randomBytes(16).toString('hex');
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

        const userResponse = await User.findById(newUser._id)
            .select(OWN_USER_EXCLUSIONS)
            .lean();

        return res.status(201).json({ token: accessToken, user: userResponse });
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ message: 'Failed to register user.' });
    }
};
