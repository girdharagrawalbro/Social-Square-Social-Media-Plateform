const { Queue, Worker } = require('bullmq');
const redis = require('../lib/redis'); 
const mailer = require('../utils/mailer');

const isRedisDisabled = process.env.DISABLE_REDIS === 'true';

// BullMQ can use the existing ioredis instance directly
const emailQueue = !isRedisDisabled ? new Queue('email', { connection: redis }) : null;

// Worker runs in the same process to process emails asynchronously
if (!isRedisDisabled) {
  const w = new Worker('email', async job => {
    const { name, data } = job;
    try {
      if (name === 'sendWelcomeEmail') {
        await mailer.sendWelcomeEmail(data.email, data.fullname);
      } else if (name === 'sendVerificationEmail') {
        await mailer.sendVerificationEmail(data.email, data.verificationUrl);
      } else if (name === 'sendOtpEmail') {
        await mailer.sendOtpEmail(data.email, data.otp);
      } else if (name === 'sendNewDeviceAlert') {
        await mailer.sendNewDeviceAlert(data.email, data.alertData);
      } else if (name === 'sendSessionRevokedEmail') {
        await mailer.sendSessionRevokedEmail(data.email, data.alertData);
      } else if (name === 'sendLockoutEmail') {
        await mailer.sendLockoutEmail(data.email, data.fullname, data.unlockTime);
      } else if (name === 'sendPasswordChangedEmail') {
        await mailer.sendPasswordChangedEmail(data.email, data.fullname);
      } else if (name === 'sendSessionsTerminatedEmail') {
        await mailer.sendSessionsTerminatedEmail(data.email);
      } else if (name === 'sendAdminSecurityAlertEmail') {
        await mailer.sendAdminSecurityAlertEmail(data.email, data.data);
      } else if (name === 'sendResetEmail') {
        await mailer.sendResetEmail(data.email, data.resetUrl);
      } else if (name === 'sendEmail') {
        await mailer.sendEmail(data);
      } else {
        console.warn(`[emailQueue] Unknown job name: ${name}`);
      }
    } catch (err) {
      console.error(`[emailQueue] Error processing job ${name} (${job.id}):`, err.message);
      throw err; // allow BullMQ to retry
    }
  }, { connection: redis, concurrency: 2, limiter: { max: 5, duration: 1000 }, stalledInterval: 12 * 60 * 60 * 1000 });
}

module.exports = { emailQueue };