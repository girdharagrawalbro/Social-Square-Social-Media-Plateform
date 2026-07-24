const axios = require('./http');
const MailLog = require('../models/MailLog');
const EmailTemplate = require('../models/EmailTemplate');

const MAIL_SERVICE_BASE_URL = process.env.MAIL_SERVICE_BASE_URL;
const MAIL_SERVICE_TIMEOUT_MS = Number(process.env.MAIL_SERVICE_TIMEOUT_MS || 30000);
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
function shouldRetry(error) {
    return error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT' || !error?.response;
}

// ─── BASE EMAIL WRAPPER ───────────────────────────────────────────────────────
async function sendEmailBase({ to, from, subject, html, text }) {
    const payload = {
        to,
        from: from || `Social Square <${RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
        subject,
        html,
        text: text || html?.replace(/<[^>]*>/g, ''),
    };

    async function sendDirectly() {
        const apiKey = process.env.RESEND_API_KEY || process.env.API;
        if (!apiKey) {
            throw new Error('No RESEND_API_KEY (or API) configured for direct Resend delivery');
        }
        const resendResponse = await axios.post(
            'https://api.resend.com/emails',
            {
                from: payload.from,
                to: Array.isArray(to) ? to : [to],
                subject: payload.subject,
                html: payload.html,
                text: payload.text
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: MAIL_SERVICE_TIMEOUT_MS
            }
        );
        console.log(`[Mailer] [Direct Resend API] Delivery SUCCESSFUL to: ${to}. ID: ${resendResponse.data?.id}`);
        return resendResponse.data;
    }

    // Direct in-process Resend execution preferred
    if (process.env.RESEND_API_KEY || process.env.API || !MAIL_SERVICE_BASE_URL) {
        return await sendDirectly();
    }

    // Optional Microservice Proxy if MAIL_SERVICE_BASE_URL is explicitly set
    const requestConfig = {
        headers: { 'Content-Type': 'application/json' },
        timeout: MAIL_SERVICE_TIMEOUT_MS,
    };

    try {
        const response = await axios.post(`${MAIL_SERVICE_BASE_URL}/send`, payload, requestConfig);

        if (response.data?.success === false) {
            throw new Error(response.data?.message || 'Mail service returned unsuccessful response');
        }

        console.log(`[Mailer] [Microservice] Delivery SUCCESSFUL to: ${to}. Subject: "${subject}"`);
        return response.data?.data;
    } catch (error) {
        console.warn(`[Mailer] [Microservice] Failed (${error.message}). Triggering Direct API Fallback...`);
        return await sendDirectly();
    }
}

async function sendEmail(args) {
    try {
        const result = await sendEmailBase(args);
        await MailLog.create({
            to: Array.isArray(args.to) ? args.to.join(', ') : args.to,
            from: args.from || `Social Square <${RESEND_FROM_EMAIL}>`,
            subject: args.subject,
            html: args.html,
            text: args.text || args.html?.replace(/<[^>]*>/g, ''),
            status: 'sent'
        }).catch(err => console.error('[Mailer MailLog Error]:', err.message));
        return result;
    } catch (err) {
        await MailLog.create({
            to: Array.isArray(args.to) ? args.to.join(', ') : args.to,
            from: args.from || `Social Square <${RESEND_FROM_EMAIL}>`,
            subject: args.subject,
            html: args.html,
            text: args.text || args.html?.replace(/<[^>]*>/g, ''),
            status: 'failed',
            error: err.message
        }).catch(e => console.error('[Mailer MailLog Error]:', e.message));
        throw err;
    }
}

// ─── TEMPLATE PARSER ──────────────────────────────────────────────────────────

async function getParsedTemplate(key, variables) {
    const template = await EmailTemplate.findOne({ key }).lean();
    if (!template) {
        throw new Error(`EmailTemplate with key '${key}' not found in database. Please seed templates.`);
    }

    let parsedHtml = template.html;
    let parsedSubject = template.subject;
    for (const [vKey, vValue] of Object.entries(variables)) {
        const regex = new RegExp(`{{${vKey}}}`, 'g');
        parsedHtml = parsedHtml.replace(regex, vValue);
        parsedSubject = parsedSubject.replace(regex, vValue);
    }
    return { subject: parsedSubject, html: parsedHtml };
}

// ─── SPECIFIC EMAIL TYPES ─────────────────────────────────────────────────────

async function sendOtpEmail(email, otp) {
    const { subject, html } = await getParsedTemplate('otp_email', { otp });
    return sendEmail({ to: email, subject, html });
}

async function sendResetEmail(email, resetUrl) {
    const { subject, html } = await getParsedTemplate('reset_email', { resetUrl });
    return sendEmail({ from: 'Social Square Support <support@social-square.me>', to: email, subject, html });
}

async function sendNewDeviceAlert(email, { device, location, time }) {
    const locationStr = typeof location === 'object'
        ? `${location.city || 'Unknown'}, ${location.country || 'Unknown'}`
        : (location || 'Unknown');

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const { subject, html } = await getParsedTemplate('new_device_alert', {
        device: device || 'Unknown',
        locationStr,
        time: time || new Date().toUTCString(),
        clientUrl
    });
    return sendEmail({ to: email, subject, html });
}

async function sendSessionRevokedEmail(email, { device, location, ip }) {
    const locationStr = typeof location === 'object'
        ? `${location.city || 'Unknown'}, ${location.country || 'Unknown'}`
        : (location || 'Unknown');

    const { subject, html } = await getParsedTemplate('session_revoked', {
        device: device || 'Unknown',
        locationStr,
        ip: ip || 'Unknown'
    });
    return sendEmail({ to: email, subject, html });
}

async function sendVerificationEmail(email, verificationUrl) {
    const { subject, html } = await getParsedTemplate('verification_email', { verificationUrl });
    return sendEmail({ to: email, subject, html });
}

async function sendLockoutEmail(email, fullname, unlockTime) {
    const { subject, html } = await getParsedTemplate('lockout_email', { fullname, unlockTime });
    return sendEmail({ to: email, subject, html });
}

// ─── DAILY DIGEST EMAIL ───────────────────────────────────────────────────────
async function sendDigestEmail(user, stats) {
    const { newFollowers, newLikes, newComments, trendingPosts = [] } = stats;

    const trendingPostsHtml = trendingPosts.slice(0, 3).length ? `
        <p style="font-size:14px;font-weight:700;color:#374151;margin:0 0 12px">🔥 Trending today</p>
        ${trendingPosts.slice(0, 3).map(p => `
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f9fafb">
            <p style="margin:0;font-size:13px;color:#374151">${(p.caption || '').slice(0, 80)}</p>
            <p style="margin:0;font-size:12px;color:#9ca3af">❤️ ${p.likes?.length || 0}</p>
        </div>`).join('')}` : '';

    const totalInteractions = newLikes + newComments + newFollowers;
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

    const { subject, html } = await getParsedTemplate('digest_email', {
        fullname: user.fullname,
        totalInteractions,
        newFollowers,
        newLikes,
        newComments,
        trendingPostsHtml,
        clientUrl
    });

    return sendEmail({ to: user.email, subject, html });
}

async function sendWelcomeEmail(email, fullname) {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const { subject, html } = await getParsedTemplate('welcome_email', { fullname, clientUrl });
    return sendEmail({ to: email, subject, html });
}

async function sendPasswordChangedEmail(email, fullname) {
    const { subject, html } = await getParsedTemplate('password_changed', { fullname });
    return sendEmail({ to: email, subject, html });
}

async function sendSessionsTerminatedEmail(email) {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const { subject, html } = await getParsedTemplate('sessions_terminated', { clientUrl });
    return sendEmail({ to: email, subject, html });
}

module.exports = {
    sendEmail,
    sendOtpEmail,
    sendResetEmail,
    sendNewDeviceAlert,
    sendLockoutEmail,
    sendDigestEmail,
    sendSessionRevokedEmail,
    sendVerificationEmail,
    sendWelcomeEmail,
    sendPasswordChangedEmail,
    sendSessionsTerminatedEmail
};