const axios = require('axios');
const { sendEmail } = require('./mailer');
const MailLog = require('../models/MailLog');

async function sendResendEmail({ to, subject, html }) {
    const apiKey = process.env.RESEND_API_KEY;
    
    if (!apiKey) {
        console.warn('[Resend] RESEND_API_KEY missing. Falling back to internal mailer.');
        return sendEmail({ to, subject, html });
    }

    try {
        const response = await axios.post(
            'https://api.resend.com/emails',
            {
                from: 'Social Square <onboarding@resend.dev>',
                to: Array.isArray(to) ? to : [to],
                subject,
                html
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        await MailLog.create({
            to: Array.isArray(to) ? to.join(', ') : to,
            from: 'Social Square <onboarding@resend.dev>',
            subject,
            html,
            status: 'sent'
        }).catch(err => console.error('[Resend MailLog Error]:', err.message));

        return response.data;
    } catch (error) {
        const errorMsg = error.response?.data?.message || error.message;
        console.error('[Resend] API call failed:', errorMsg);
        
        await MailLog.create({
            to: Array.isArray(to) ? to.join(', ') : to,
            from: 'Social Square <onboarding@resend.dev>',
            subject,
            html,
            status: 'failed',
            error: errorMsg
        }).catch(err => console.error('[Resend MailLog Error]:', err.message));

        // Fallback
        return sendEmail({ to, subject, html });
    }
}

module.exports = { sendResendEmail };
