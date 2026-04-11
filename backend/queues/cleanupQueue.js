const { Queue, Worker } = require('bullmq');
const Notification = require('../models/Notification');
const redis = require('../lib/redis');

const isRedisDisabled = process.env.DISABLE_REDIS === 'true';

// ─── QUEUE ────────────────────────────────────────────────────────────────────
const cleanupQueue = !isRedisDisabled ? new Queue('systemCleanup', { connection: redis }) : null;

// ─── SCHEDULE CLEANUP ─────────────────────────────────────────────────────────
async function scheduleCleanup() {
    if (isRedisDisabled || !cleanupQueue) {
        console.log('[Cleanup] Skipped (Redis is disabled)');
        return;
    }
    try {
        const jobs = await cleanupQueue.getRepeatableJobs();
        for (const job of jobs) await cleanupQueue.removeRepeatableByKey(job.key);

        // Run every day at 3:00 AM UTC
        await cleanupQueue.add('notification-cleanup', {}, {
            repeat: { cron: '0 3 * * *' },
            removeOnComplete: true,
        });
        console.log('[Cleanup] Notification cleanup scheduled for 3:00 AM UTC');
    } catch (err) {
        console.warn('[Cleanup] Failed to schedule:', err.message);
    }
}

// ─── WORKER ───────────────────────────────────────────────────────────────────
let worker = null;

if (!isRedisDisabled) {
    worker = new Worker('systemCleanup', async (job) => {
        if (job.name !== 'notification-cleanup') return;

        console.log('[Cleanup] Starting notification cleanup...');

        try {
            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

            // 1. Delete READ notifications older than 3 days
            const oldDeleted = await Notification.deleteMany({
                read: true,
                type: { $ne: 'follow_request' }, 
                createdAt: { $lt: threeDaysAgo }
            });
            console.log(`[Cleanup] Purged ${oldDeleted.deletedCount} old read notifications.`);

            // 2. Cap READ notifications at 200 per user
            const usersToCleanup = await Notification.aggregate([
                { $match: { read: true } },
                { $group: { _id: '$recipient', count: { $sum: 1 } } },
                { $match: { count: { $gt: 200 } } }
            ]);

            let totalCapped = 0;
            for (const user of usersToCleanup) {
                const thresholdDoc = await Notification.find({ recipient: user._id, read: true })
                    .sort({ createdAt: -1 })
                    .skip(200)
                    .limit(1)
                    .select('createdAt')
                    .lean();

                if (thresholdDoc.length > 0) {
                    const result = await Notification.deleteMany({
                        recipient: user._id,
                        read: true,
                        createdAt: { $lte: thresholdDoc[0].createdAt }
                    });
                    totalCapped += result.deletedCount;
                }
            }
            console.log(`[Cleanup] Capped excess read notifications for ${usersToCleanup.length} users. Total deleted: ${totalCapped}`);

        } catch (err) {
            console.error('[Cleanup] Error during notification cleanup:', err.message);
        }

    }, {
        connection: redis,
        concurrency: 2,
        limiter: { max: 5, duration: 1000 },
    });

    worker.on('failed', (job, err) => console.error('[Cleanup] Job failed:', err.message));
}

module.exports = { cleanupQueue, scheduleCleanup };
