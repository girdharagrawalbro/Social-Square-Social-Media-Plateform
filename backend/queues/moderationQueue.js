const { Queue, Worker } = require('bullmq');
const redis = require('../lib/redis');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const AuditLog = require('../models/AuditLog');
const { classifyToxicity, evaluateModeration } = require('../services/moderationService');

const isRedisDisabled = process.env.DISABLE_REDIS === 'true';

// Core moderation logic
const processModerationJob = async (jobData) => {
    const { contentId, contentType, text } = jobData;
    console.log(`[ModerationWorker] Processing ${contentType} ${contentId}`);

    const Model = contentType === 'post' ? Post : Comment;
    const content = await Model.findById(contentId);
    if (!content) return;

    // 1. Get toxicity score from AI (async, high-fidelity)
    const score = await classifyToxicity(text);
    
    // 2. Evaluate thresholds (combines local profanity + AI score)
    const { isVisible, isFlagged, reason } = await evaluateModeration(score, text);

    // 3. Update database
    await Model.findByIdAndUpdate(contentId, {
        isVisible,
        isFlagged,
        moderationScore: score,
        moderationReason: reason
    });

    // 4. Audit Log for traceability
    if (isFlagged || !isVisible) {
        await AuditLog.create({
            admin: null,
            action: 'AUTOMATED_MODERATION',
            targetType: contentType,
            targetId: contentId,
            meta: {
                oldValue: { isVisible: content.isVisible, isFlagged: content.isFlagged },
                newValue: { isVisible, isFlagged },
                reason: `Score: ${score}, Reason: ${reason}. Severity: ${!isVisible ? 'high' : 'medium'}`
            }
        });
    }
};

let moderationQueue;

if (!isRedisDisabled) {
    moderationQueue = new Queue('moderation', { 
        connection: redis,
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000,
            },
            removeOnComplete: true,
            removeOnFail: false, // Keep failed jobs for inspection (Dead Letter)
        }
    });

    const worker = new Worker('moderation', async (job) => {
        try {
            await processModerationJob(job.data);
        } catch (error) {
            console.error(`[ModerationWorker] Error processing job ${job.id}:`, error.message);
            throw error; // Trigger BullMQ retry
        }
    }, { 
        connection: redis, 
        concurrency: 5 
    });

    worker.on('failed', (job, err) => {
        if (job.attemptsMade >= 3) {
            console.error(`[ModerationWorker] Job ${job.id} PERMANENTLY FAILED. Content ID: ${job.data.contentId}`);
        }
    });
} else {
    console.log('[ModerationQueue] Redis disabled, using in-memory fallback processor.');
    moderationQueue = {
        add: async (name, data) => {
            // Process asynchronously without blocking the request
            setImmediate(async () => {
                try {
                    await processModerationJob(data);
                } catch (error) {
                    console.error(`[ModerationWorker (Fallback)] Error processing job:`, error.message);
                }
            });
            return Promise.resolve(); // Mock successful queue addition
        }
    };
}

module.exports = { moderationQueue };
