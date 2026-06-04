const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const Contact = require('../models/Contact');
const { getIp, parseDevice, getLocation } = require('../utils/authSecurity');
const { sendEmail } = require('../utils/mailer');

const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many contact form submissions. Please try again in an hour.' }
});

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
};

router.post('/', contactLimiter, [
    body('name').trim().isLength({ min: 3 }).withMessage('Name must be at least 3 characters long'),
    body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
    body('mobile').optional({ checkFalsy: true }).trim().isMobilePhone().withMessage('Please provide a valid mobile number'),
    body('message').trim().isLength({ min: 1, max: 200 }).withMessage('Message must be between 1 and 200 characters'),
    validate
], async (req, res) => {
    try {
        const { name, email, mobile, message } = req.body;
        const ip = getIp(req);
        const device = parseDevice(req.headers['user-agent']);
        const location = await getLocation(ip);

        const contact = new Contact({
            name,
            email,
            mobile: mobile || undefined,
            message,
            ip,
            device,
            location,
            status: 'unseen'
        });

        await contact.save();

        // Send confirmation email to the user
        const supportEmailHtml = `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;border:1px solid #f3f4f6;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.05)">
            <h2 style="color:#808bf5;margin-top:0">We've Received Your Message! 📬</h2>
            <p>Hi <strong>${name}</strong>,</p>
            <p>Thank you for reaching out to us. We have successfully received your query and our team will get back to you as soon as possible.</p>
            <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;font-size:14px;color:#374151">
                <p style="margin:0 0 8px"><strong>Your query summary:</strong></p>
                <p style="margin:0;font-style:italic;color:#6b7280">"${message}"</p>
            </div>
            <p style="color:#6b7280;font-size:12px;margin-top:20px">This is an automated confirmation. Please do not reply directly to this email.</p>
        </div>`;

        await sendEmail({
            to: email,
            subject: 'We received your query - Social Square Support',
            html: supportEmailHtml
        }).catch(err => console.error('[Mailer] Contact form confirmation failed:', err.message));

        res.status(201).json({ success: true, message: 'Contact request recorded successfully' });
    } catch (error) {
        console.error('Contact submission error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
