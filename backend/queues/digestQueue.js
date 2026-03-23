const { Queue, Worker } = require('bullmq');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const redis = require('../lib/redis'); 

// ─── QUEUE ────────────────────────────────────────────────────────────────────
const digestQueue = new Queue('emailDigest', { connection: redis });

// ─── SCHEDULE DAILY DIGEST ────────────────────────────────────────────────────
// Called from a cron job or on app start
async function scheduleDailyDigest() {
    // Remove existing repeatable jobs to avoid duplicates
    const jobs = await digestQueue.getRepeatableJobs();
    for (const job of jobs) await digestQueue.removeRepeatableByKey(job.key);

    // Schedule daily at 8:00 AM UTC
    await digestQueue.add('daily-digest', {}, {
        repeat: { cron: '0 8 * * *' },
        removeOnComplete: true,
    });
    console.log('[Digest] Daily digest scheduled for 8:00 AM UTC');
}

// ─── MAILER ───────────────────────────────────────────────────────────────────
function getTransporter() {
    const user = process.env.EMAIL_USER?.trim();
    const pass = process.env.EMAIL_PASS?.trim();
    if (!user || !pass) {
        return { sendMail: async () => { console.warn("[Digest] Mailer skipped: Credentials missing"); } };
    }
    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
    });
}
const transporter = getTransporter();

function buildDigestEmail(user, stats) {
    const { newFollowers, newLikes, newComments, trendingPosts } = stats;

    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 20px;">
        <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #808bf5, #6366f1); padding: 32px 28px; text-align: center;">
                <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 800;">Social Square</h1>
                <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Your daily activity digest</p>
            </div>

            <!-- Greeting -->
            <div style="padding: 28px 28px 0;">
                <p style="font-size: 16px; color: #374151; margin: 0;">Hi <strong>${user.fullname}</strong> 👋</p>
                <p style="font-size: 14px; color: #6b7280; margin: 8px 0 0;">Here's what happened on Social Square yesterday.</p>
            </div>

            <!-- Stats -->
            <div style="padding: 20px 28px; display: flex; gap: 12px;">
                ${[
                    { icon: '👥', label: 'New Followers', value: newFollowers },
                    { icon: '❤️', label: 'Post Likes',    value: newLikes },
                    { icon: '💬', label: 'Comments',      value: newComments },
                ].map(s => `
                    <div style="flex: 1; background: #f9fafb; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #f3f4f6;">
                        <p style="font-size: 24px; margin: 0;">${s.icon}</p>
                        <p style="font-size: 22px; font-weight: 800; color: #111827; margin: 8px 0 2px;">${s.value}</p>
                        <p style="font-size: 11px; color: #9ca3af; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">${s.label}</p>
                    </div>
                `).join('')}
            </div>

            <!-- Trending posts -->
            ${trendingPosts.length > 0 ? `
            <div style="padding: 0 28px 24px;">
                <p style="font-size: 14px; font-weight: 700; color: #374151; margin: 0 0 12px;">🔥 Trending today</p>
                ${trendingPosts.slice(0, 3).map(post => `
                    <div style="display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f9fafb;">
                        <div style="flex: 1;">
                            <p style="margin: 0; font-size: 13px; color: #374151; font-weight: 600;">${post.user?.fullname || 'Anonymous'}</p>
                            <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">${(post.caption || '').slice(0, 80)}${post.caption?.length > 80 ? '...' : ''}</p>
                        </div>
                        <div style="text-align: right; flex-shrink: 0;">
                            <p style="margin: 0; font-size: 12px; color: #9ca3af;">❤️ ${post.likes?.length || 0}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
            ` : ''}

            <!-- CTA -->
            <div style="padding: 0 28px 28px; text-align: center;">
                <a href="${process.env.CLIENT_URL}" style="display: inline-block; background: linear-gradient(135deg, #808bf5, #6366f1); color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 14px;">Open Social Square →</a>
            </div>

            <!-- Footer -->
            <div style="padding: 16px 28px; background: #f9fafb; border-top: 1px solid #f3f4f6; text-align: center;">
                <p style="font-size: 11px; color: '#9ca3af'; margin: 0;">
                    You're receiving this because you have email digests enabled.
                    <a href="${process.env.CLIENT_URL}/settings" style="color: #808bf5;">Unsubscribe</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
}

// ─── WORKER ───────────────────────────────────────────────────────────────────
const worker = new Worker('emailDigest', async (job) => {
    if (job.name !== 'daily-digest') return;

    console.log('[Digest] Starting daily digest job');

    const yesterday = new Date(Date.now() - 86400000);

    // Get users with digest enabled
    const users = await User.find({
        'notificationSettings.emailDigest': true,
        isBanned: { $ne: true },
        email: { $exists: true },
    }).select('fullname email _id').lean();

    console.log(`[Digest] Sending to ${users.length} users`);

    let sent = 0, failed = 0;

    for (const user of users) {
        try {
            // Get user's stats for yesterday
            const [newFollowers, notifications, trendingPosts] = await Promise.all([
                User.countDocuments({ followers: user._id, created_at: { $gte: yesterday } }),
                Notification.find({ recipient: user._id, createdAt: { $gte: yesterday } }).lean(),
                Post.find({ createdAt: { $gte: yesterday } }).sort({ score: -1 }).limit(5).select('caption user likes').lean(),
            ]);

            const newLikes    = notifications.filter(n => n.type === 'like').length;
            const newComments = notifications.filter(n => n.type === 'comment').length;

            // Skip if nothing happened
            if (newFollowers === 0 && newLikes === 0 && newComments === 0) continue;

            await transporter.sendMail({
                from:    `"Social Square" <${process.env.EMAIL_USER}>`,
                to:      user.email,
                subject: `${user.fullname}, you had ${newLikes + newComments + newFollowers} interactions yesterday 🔥`,
                html:    buildDigestEmail(user, { newFollowers, newLikes, newComments, trendingPosts }),
            });

            sent++;
        } catch (err) {
            console.error(`[Digest] Failed for ${user.email}:`, err.message);
            failed++;
        }

        // Rate limit: 10 emails/second (Gmail limit)
        await new Promise(r => setTimeout(r, 100));
    }

    console.log(`[Digest] Done — sent: ${sent}, failed: ${failed}`);
}, { connection, concurrency: 1 });

worker.on('failed', (job, err) => console.error('[Digest] Job failed:', err.message));

module.exports = { digestQueue, scheduleDailyDigest };