const { Queue, Worker } = require('bullmq');
const User = require('../models/User');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const redis = require('../lib/redis');
const { sendEmail } = require('../utils/mailer');
const SystemSetting = require('../models/SystemSetting');

const isRedisDisabled = process.env.DISABLE_REDIS === 'true';

// ─── QUEUE ────────────────────────────────────────────────────────────────────
const digestQueue = !isRedisDisabled ? new Queue('emailDigest', { connection: redis }) : null;

// ─── SCHEDULE DAILY DIGEST ────────────────────────────────────────────────────
async function scheduleDailyDigest() {
    if (isRedisDisabled || !digestQueue) {
        console.log('[Digest] BullMQ Skipped (Redis disabled). Internal interval fallback online.');
        setInterval(async () => {
            try { await runAdminDigests(); } catch (e) { console.error('[Digest] Admin Digest Fallback Error:', e.message); }
        }, 24 * 60 * 60 * 1000);
        return;
    }
    try {
        const jobs = await digestQueue.getRepeatableJobs();
        for (const job of jobs) await digestQueue.removeRepeatableByKey(job.key);

        await digestQueue.add('daily-digest', {}, {
            repeat: { cron: '0 8 * * *' },
            removeOnComplete: true,
        });

        await digestQueue.add('admin-daily-digest', {}, {
            repeat: { cron: '0 9 * * *' },
            removeOnComplete: true,
        });

        console.log('[Digest] Scheduled both daily user and admin repeatable jobs');
    } catch (err) {
        console.warn('[Digest] Failed to schedule:', err.message);
    }
}

async function runAdminDigests(bypassFlag = false) {
    if (!bypassFlag) {
        try {
            const setting = await SystemSetting.findOne({ key: 'admin_daily_digest' }).lean();
            if (setting && setting.value === false) {
                console.log('[Digest] Admin daily digest is disabled via system settings.');
                return;
            }
        } catch (err) {
            console.error('[Digest] Error checking admin_daily_digest flag:', err.message);
        }
    }
    const yesterday = new Date(Date.now() - 86400000);
    const lastWeek = new Date(Date.now() - 604800000);

    const admins = await User.find({ isAdmin: true, email: { $exists: true } }).lean();
    if (!admins.length) return;

    const [newUsers, newPosts, activeUsers, aiPosts] = await Promise.all([
        User.countDocuments({ createdAt: { $gte: yesterday } }),
        Post.countDocuments({ createdAt: { $gte: yesterday } }),
        User.countDocuments({ lastActiveAt: { $gte: yesterday } }),
        Post.countDocuments({ isAiGenerated: true, createdAt: { $gte: yesterday } })
    ]);

    const oldUsers = await User.countDocuments({ createdAt: { $gte: lastWeek, $lt: yesterday } });
    const wowDelta = oldUsers > 0 ? (((newUsers - (oldUsers / 7)) / (oldUsers / 7)) * 100).toFixed(1) : 100;
    const estimatedCost = (aiPosts * 0.02).toFixed(2);

    const growthStats = { newUsers, newPosts, activeUsers, wowDelta };
    const aiStats = { aiPosts, estimatedCost };

    const { sendResendEmail } = require('../utils/resend.helper');

    for (const admin of admins) {
        try {
            await sendResendEmail({
                to: admin.email,
                subject: `📊 Admin Daily Digest — Social Square`,
                html: buildCombinedAdminDigestEmail(admin, growthStats, aiStats)
            });
        } catch (err) {
            console.error(`[Admin Digest] Failed for ${admin.email}:`, err.message);
        }
    }
}

function buildCombinedAdminDigestEmail(user, growthStats, aiStats) {
    return `
    <!DOCTYPE html><html><body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:20px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
        <div style="background:linear-gradient(135deg,#808bf5,#6366f1);padding:32px 28px;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:24px">Social Square</h1>
            <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">Admin Daily Activity & Analytics Digest</p>
        </div>
        <div style="padding:28px">
            <p style="font-size:16px;color:#374151;margin:0">Hi <strong>${user.fullname}</strong> (Administrator) 👋</p>
            <p style="font-size:14px;color:#6b7280;margin:8px 0 20px">Here is the daily system overview and resource utilization summary.</p>
            
            <h3 style="color:#808bf5;margin:24px 0 12px;font-size:16px;border-bottom:1px solid #e5e7eb;padding-bottom:6px">📊 Daily Growth Metrics</h3>
            <div style="background:#f9fafb;border:1px solid #f3f4f6;border-radius:12px;padding:16px;margin-bottom:20px">
                <p style="margin:8px 0;font-size:14px;color:#374151">👤 <strong>New Signups:</strong> ${growthStats.newUsers}</p>
                <p style="margin:8px 0;font-size:14px;color:#374151">📝 <strong>New Publications:</strong> ${growthStats.newPosts}</p>
                <p style="margin:8px 0;font-size:14px;color:#374151">🔥 <strong>Active Segment:</strong> ${growthStats.activeUsers} members</p>
                <p style="margin:8px 0;font-size:14px;color:#374151">📈 <strong>Week-over-Week Delta:</strong> ${growthStats.wowDelta}%</p>
            </div>

            <h3 style="color:#6366f1;margin:24px 0 12px;font-size:16px;border-bottom:1px solid #e5e7eb;padding-bottom:6px">🤖 Daily AI Usage Insights</h3>
            <div style="background:#f5f3ff;border:1px solid #ede9fe;border-radius:12px;padding:16px;margin-bottom:20px">
                <p style="margin:8px 0;font-size:14px;color:#374151">⚡ <strong>AI Posts Generated:</strong> ${aiStats.aiPosts}</p>
                <p style="margin:8px 0;font-size:14px;color:#374151">💸 <strong>Approximate Costs:</strong> $${aiStats.estimatedCost}</p>
            </div>
            
            <div style="text-align:center;margin-top:28px">
                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/admin" style="display:inline-block;background:linear-gradient(135deg,#808bf5,#6366f1);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px">Open Admin Control Panel →</a>
            </div>
        </div>
        <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #f3f4f6;text-align:center">
            <p style="font-size:11px;color:#9ca3af;margin:0">This is an automated system email sent to administrators.</p>
        </div>
    </div></body></html>`;
}

function buildDigestEmail(user, stats) {
    const { newFollowers, newLikes, newComments, trendingPosts } = stats;

    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 20px;">
        <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            <div style="background: linear-gradient(135deg, #808bf5, #6366f1); padding: 32px 28px; text-align: center;">
                <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 800;">Social Square</h1>
                <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Your daily activity digest</p>
            </div>
            <div style="padding: 28px 28px 0;">
                <p style="font-size: 16px; color: #374151; margin: 0;">Hi <strong>${user.fullname}</strong> 👋${user.isAdmin ? ' (Admin)' : ''}</p>
                <p style="font-size: 14px; color: #6b7280; margin: 8px 0 0;">
                    ${(newFollowers + newLikes + newComments) > 0
            ? "Here's what happened on Social Square yesterday."
            : "Everything is running smoothly! No new personal activity to report for yesterday."}
                </p>
            </div>
            <div style="padding: 20px 28px; display: flex; gap: 12px;">
                ${[
            { icon: '👥', label: 'New Followers', value: newFollowers },
            { icon: '❤️', label: 'Post Likes', value: newLikes },
            { icon: '💬', label: 'Comments', value: newComments },
        ].map(s => `
                    <div style="flex: 1; background: #f9fafb; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #f3f4f6;">
                        <p style="font-size: 24px; margin: 0;">${s.icon}</p>
                        <p style="font-size: 22px; font-weight: 800; color: #111827; margin: 8px 0 2px;">${s.value}</p>
                        <p style="font-size: 11px; color: #9ca3af; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">${s.label}</p>
                    </div>
                `).join('')}
            </div>
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
            <div style="padding: 0 28px 28px; text-align: center;">
                <a href="${process.env.CLIENT_URL}" style="display: inline-block; background: linear-gradient(135deg, #808bf5, #6366f1); color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 14px;">Open Social Square →</a>
            </div>
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
if (!isRedisDisabled) {
    const worker = new Worker('emailDigest', async (job) => {
        if (job.name === 'admin-daily-digest') {
            console.log('[Digest] Starting Admin daily digests job');
            const bypassFlag = job.data?.manual || false;
            await runAdminDigests(bypassFlag);
            return;
        }
        if (job.name !== 'daily-digest') return;

        console.log('[Digest] Starting daily digest job');

        const yesterday = new Date(Date.now() - 86400000);

        const users = await User.find({
            'notificationSettings.emailDigest': true,
            isBanned: { $ne: true },
            email: { $exists: true },
        }).select('fullname email _id isAdmin').lean();

        console.log(`[Digest] Sending to ${users.length} users`);

        let sent = 0, failed = 0;

        for (const user of users) {
            try {
                const [newFollowers, notifications, trendingPosts] = await Promise.all([
                    User.countDocuments({ followers: user._id, created_at: { $gte: yesterday } }),
                    Notification.find({ recipient: user._id, createdAt: { $gte: yesterday } }).lean(),
                    Post.find({ createdAt: { $gte: yesterday } }).sort({ score: -1 }).limit(5).select('caption user likes').lean(),
                ]);

                const newLikes = notifications.filter(n => n.type === 'like').length;
                const newComments = notifications.filter(n => n.type === 'comment').length;

                if (newFollowers === 0 && newLikes === 0 && newComments === 0 && !user.isAdmin) continue;

                await sendEmail({
                    to: user.email,
                    subject: `${user.fullname}, you had ${newLikes + newComments + newFollowers} interactions yesterday 🔥`,
                    html: buildDigestEmail(user, { newFollowers, newLikes, newComments, trendingPosts }),
                });

                sent++;
            } catch (err) {
                console.error(`[Digest] Failed for ${user.email}:`, err.message);
                failed++;
            }

            await new Promise(r => setTimeout(r, 100));
        }

        console.log(`[Digest] Done — sent: ${sent}, failed: ${failed}`);
    }, {
        connection: redis,
        concurrency: 2,
        limiter: { max: 5, duration: 1000 },
        stalledInterval: 12 * 60 * 60 * 1000, // Check for stalled jobs every 12 hours (reduces Redis traffic)
    });

    worker.on('failed', (job, err) => console.error('[Digest] Job failed:', err.message));
}

module.exports = { digestQueue, scheduleDailyDigest, runAdminDigests };