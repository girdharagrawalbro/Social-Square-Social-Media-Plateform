const axios = require('axios');

const MAIL_SERVICE_BASE_URL = process.env.MAIL_SERVICE_BASE_URL;
const MAIL_SERVICE_TIMEOUT_MS = Number(process.env.MAIL_SERVICE_TIMEOUT_MS || 30000);

function shouldRetry(error) {
    return error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT' || !error?.response;
}

// ─── BASE EMAIL WRAPPER ───────────────────────────────────────────────────────
async function sendEmail({ to, subject, html, text }) {
    const payload = {
        to,
        subject,
        html,
        text: text || html?.replace(/<[^>]*>/g, ''),
    };

    const requestConfig = {
        headers: { 'Content-Type': 'application/json' },
        timeout: MAIL_SERVICE_TIMEOUT_MS,
    };

    try {
        const response = await axios.post(`${MAIL_SERVICE_BASE_URL}/send`, payload, requestConfig);

        if (response.data?.success === false) {
            throw new Error(response.data?.message || 'Mail service returned unsuccessful response');
        }

        return response.data?.data;
    } catch (error) {
        if (shouldRetry(error)) {
            try {
                const retryResponse = await axios.post(`${MAIL_SERVICE_BASE_URL}/send`, payload, requestConfig);
                if (retryResponse.data?.success === false) {
                    throw new Error(retryResponse.data?.message || 'Mail service returned unsuccessful response');
                }
                return retryResponse.data?.data;
            } catch (retryError) {
                const retryReason = retryError.response?.data?.message || retryError.message;
                throw new Error(`Mail API send failed after retry: ${retryReason}`);
            }
        }
        const reason = error.response?.data?.message || (error.response?.data?.error) || error.message;
        throw new Error(`Mail API send failed [Source: ${MAIL_SERVICE_BASE_URL}]: ${reason}`);
    }
}

// ─── SPECIFIC EMAIL TYPES ─────────────────────────────────────────────────────

async function sendOtpEmail(email, otp) {
    return sendEmail({
        to: email,
        subject: 'Your Social Square verification code',
        html: `
        <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px">
            <h2 style="color:#808bf5">Social Square</h2>
            <p>Your verification code is:</p>
            <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#808bf5;padding:16px;background:#f5f3ff;border-radius:8px;text-align:center">${otp}</div>
            <p style="color:#6b7280;font-size:12px;margin-top:16px">Expires in 10 minutes. Do not share this code.</p>
        </div>`
    });
}

async function sendResetEmail(email, resetUrl) {
    return sendEmail({
        to: email,
        subject: 'Reset your Social Square password',
        html: `
        <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px">
            <h2 style="color:#808bf5">Password Reset</h2>
            <p>Click the button below to reset your password. This link expires in 1 hour.</p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#808bf5;color:#fff;text-decoration:none;border-radius:8px;margin:16px 0">Reset Password</a>
            <p style="color:#6b7280;font-size:12px">If you didn't request this, ignore this email.</p>
        </div>`
    });
}

async function sendNewDeviceAlert(email, { device, location, time }) {
    return sendEmail({
        to: email,
        subject: '⚠️ New device login detected — Social Square',
        html: `
        <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px">
            <h2 style="color:#ef4444">New Login Detected</h2>
            <p>Your account was accessed from a new device:</p>
            <ul style="color:#374151">
                <li><strong>Device:</strong> ${device || 'Unknown'}</li>
                <li><strong>Location:</strong> ${location || 'Unknown'}</li>
                <li><strong>Time:</strong> ${time || new Date().toUTCString()}</li>
            </ul>
            <p>If this was you, no action needed. If not, <a href="${process.env.CLIENT_URL}/sessions">review your sessions</a> immediately.</p>
        </div>`
    });
}

async function sendLockoutEmail(email, unlockTime) {
    return sendEmail({
        to: email,
        subject: '🔒 Account temporarily locked — Social Square',
        html: `
        <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px">
            <h2 style="color:#f59e0b">Account Locked</h2>
            <p>Too many failed login attempts. Your account is locked until:</p>
            <p style="font-size:18px;font-weight:bold;color:#808bf5">${new Date(unlockTime).toLocaleString()}</p>
            <p style="color:#6b7280;font-size:12px">If this wasn't you, consider resetting your password after the lockout expires.</p>
        </div>`
    });
}

// ─── DAILY DIGEST EMAIL ───────────────────────────────────────────────────────
async function sendDigestEmail(user, stats) {
    const { newFollowers, newLikes, newComments, trendingPosts = [] } = stats;
    return sendEmail({
        to: user.email,
        subject: `${user.fullname}, you had ${newLikes + newComments + newFollowers} interactions yesterday 🔥`,
        html: `
        <!DOCTYPE html><html><body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:20px">
        <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
            <div style="background:linear-gradient(135deg,#808bf5,#6366f1);padding:32px 28px;text-align:center">
                <h1 style="color:#fff;margin:0;font-size:24px">Social Square</h1>
                <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">Your daily activity digest</p>
            </div>
            <div style="padding:28px">
                <p style="font-size:16px;color:#374151;margin:0">Hi <strong>${user.fullname}</strong> 👋</p>
                <p style="font-size:14px;color:#6b7280;margin:8px 0 20px">Here's what happened on Social Square yesterday.</p>
                <div style="display:flex;gap:12px;margin-bottom:24px">
                    ${[['👥', 'New Followers', newFollowers], ['❤️', 'Post Likes', newLikes], ['💬', 'Comments', newComments]].map(([icon, label, val]) => `
                    <div style="flex:1;background:#f9fafb;border-radius:12px;padding:16px;text-align:center;border:1px solid #f3f4f6">
                        <p style="font-size:24px;margin:0">${icon}</p>
                        <p style="font-size:22px;font-weight:800;color:#111827;margin:8px 0 2px">${val}</p>
                        <p style="font-size:11px;color:#9ca3af;margin:0;text-transform:uppercase;letter-spacing:.05em">${label}</p>
                    </div>`).join('')}
                </div>
                ${trendingPosts.slice(0, 3).length ? `
                <p style="font-size:14px;font-weight:700;color:#374151;margin:0 0 12px">🔥 Trending today</p>
                ${trendingPosts.slice(0, 3).map(p => `
                <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f9fafb">
                    <p style="margin:0;font-size:13px;color:#374151">${(p.caption || '').slice(0, 80)}</p>
                    <p style="margin:0;font-size:12px;color:#9ca3af">❤️ ${p.likes?.length || 0}</p>
                </div>`).join('')}` : ''}
                <div style="text-align:center;margin-top:24px">
                    <a href="${process.env.CLIENT_URL}" style="display:inline-block;background:linear-gradient(135deg,#808bf5,#6366f1);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px">Open Social Square →</a>
                </div>
            </div>
            <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #f3f4f6;text-align:center">
                <p style="font-size:11px;color:#9ca3af;margin:0">
                    <a href="${process.env.CLIENT_URL}/settings" style="color:#808bf5">Unsubscribe from digest</a>
                </p>
            </div>
        </div></body></html>`
    });
}

async function sendVerificationEmail(email, verificationUrl) {
    return sendEmail({
        to: email,
        subject: 'Verify your Social Square account',
        html: `
        <!DOCTYPE html><html><body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:20px">
        <div style="max-width:400px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;text-align:center;box-shadow:0 10px 30px rgba(128,139,245,0.1)">
            <h1 style="color:#808bf5;margin:0;font-size:24px">Social Square</h1>
            <p style="color:#374151;margin:20px 0 10px;font-weight:600">Verification Required</p>
            <p style="color:#6b7280;font-size:14px;margin-bottom:24px">Welcome! Please click the button below to verify your email address and unlock all features.</p>
            <a href="${verificationUrl}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#808bf5,#6366f1);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;box-shadow:0 4px 15px rgba(128,139,245,0.3)">Verify Email</a>
            <p style="color:#9ca3af;font-size:11px;margin-top:24px">This link will expire in 24 hours. If you did not sign up for Social Square, please ignore this email.</p>
        </div></body></html>`
    });
}

module.exports = {
    sendEmail,
    sendOtpEmail,
    sendResetEmail,
    sendNewDeviceAlert,
    sendLockoutEmail,
    sendDigestEmail,
    sendVerificationEmail,
};