const nodemailer = require('nodemailer');

function getTransporter() {
    const user = process.env.EMAIL_USER?.trim();
    const pass = process.env.EMAIL_PASS?.trim();
    if (!user || !pass) {
        return {
            sendMail: async () => {
                console.warn("[Mailer] Skipped email sending: EMAIL_USER or EMAIL_PASS is missing in environment variables.");
            }
        };
    }
    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
    });
}

async function sendNewDeviceAlert({ email, fullname, device, ip, location, time }) {
    await getTransporter().sendMail({
        from: `"Social Square Security" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '⚠️ New device login detected',
        html: `
            <div style="font-family:sans-serif;max-width:500px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                <div style="background:#6366f1;padding:20px 24px;">
                    <h2 style="color:#fff;margin:0;">New Login Detected</h2>
                </div>
                <div style="padding:24px;">
                    <p>Hi <strong>${fullname}</strong>,</p>
                    <p>We detected a login to your Social Square account from a new device.</p>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                        <tr style="border-bottom:1px solid #f3f4f6;">
                            <td style="padding:8px;color:#6b7280;font-size:14px;">Device</td>
                            <td style="padding:8px;font-size:14px;"><strong>${device}</strong></td>
                        </tr>
                        <tr style="border-bottom:1px solid #f3f4f6;">
                            <td style="padding:8px;color:#6b7280;font-size:14px;">IP Address</td>
                            <td style="padding:8px;font-size:14px;"><strong>${ip}</strong></td>
                        </tr>
                        <tr style="border-bottom:1px solid #f3f4f6;">
                            <td style="padding:8px;color:#6b7280;font-size:14px;">Location</td>
                            <td style="padding:8px;font-size:14px;"><strong>${location.city}, ${location.region}, ${location.country}</strong></td>
                        </tr>
                        <tr>
                            <td style="padding:8px;color:#6b7280;font-size:14px;">Time</td>
                            <td style="padding:8px;font-size:14px;"><strong>${time}</strong></td>
                        </tr>
                    </table>
                    <p style="color:#ef4444;font-size:14px;">If this wasn't you, <strong>change your password immediately</strong>.</p>
                </div>
            </div>`,
    });
}

async function sendResetEmail(email, resetUrl) {
    await getTransporter().sendMail({
        from: `"Social Square" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Reset your password',
        html: `
            <div style="font-family:sans-serif;max-width:480px;margin:auto;">
                <h2>Password Reset</h2>
                <p>Click the button below to reset your password. Expires in <strong>1 hour</strong>.</p>
                <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;">Reset Password</a>
                <p style="margin-top:16px;color:#888;">If you didn't request this, ignore this email.</p>
            </div>`,
    });
}

async function sendOtpEmail(email, fullname, otp) {
    await getTransporter().sendMail({
        from: `"Social Square" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Your login verification code',
        html: `
            <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                <div style="background:#6366f1;padding:20px 24px;">
                    <h2 style="color:#fff;margin:0;">Verification Code</h2>
                </div>
                <div style="padding:24px;text-align:center;">
                    <p>Hi <strong>${fullname}</strong>, use the code below to complete your login.</p>
                    <div style="font-size:42px;font-weight:800;letter-spacing:12px;color:#6366f1;margin:24px 0;">
                        ${otp}
                    </div>
                    <p style="color:#6b7280;font-size:13px;">This code expires in <strong>10 minutes</strong>.</p>
                    <p style="color:#ef4444;font-size:13px;">Never share this code with anyone.</p>
                </div>
            </div>`,
    });
}

async function sendLockoutEmail(email, fullname, unlockTime) {
    await getTransporter().sendMail({
        from: `"Social Square Security" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🔒 Account temporarily locked',
        html: `
            <div style="font-family:sans-serif;max-width:480px;margin:auto;">
                <h2>Account Locked</h2>
                <p>Hi <strong>${fullname}</strong>,</p>
                <p>Your account has been temporarily locked due to too many failed login attempts.</p>
                <p>You can try again after <strong>${unlockTime}</strong>.</p>
                <p style="color:#6b7280;font-size:13px;">If this wasn't you, please reset your password immediately.</p>
            </div>`,
    });
}

module.exports = { sendNewDeviceAlert, sendResetEmail, sendOtpEmail, sendLockoutEmail };