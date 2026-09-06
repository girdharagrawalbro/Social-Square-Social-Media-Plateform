/**
 * BACKFILL: image/video dimensions for existing posts
 *
 * New posts already get `imageDimensions` / `videoDimensions` captured at upload
 * time (see routes/media.js + routes/post.js), which the app uses to size a
 * post's container correctly on first render instead of resizing after load.
 * This script applies the same metadata retroactively to posts created before
 * that change, by probing each image/video URL directly with ffprobe (already
 * a project dependency via ffmpeg-static/ffprobe-static — no new install).
 *
 * Safe to re-run: it only touches posts missing dimensions (or with a failed/
 * placeholder entry from a previous run), so an interrupted run can just be
 * restarted.
 *
 * RUN:
 *   node scripts/backfill_post_dimensions.js [--dry-run] [--limit=500] [--concurrency=5]
 */

const mongoose = require('mongoose');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');
const pLimit = require('p-limit');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffprobeStatic = require('ffprobe-static');

dotenv.config({ path: path.join(__dirname, '../.env') });
ffmpeg.setFfprobePath(ffprobeStatic.path);

const Post = require('../models/Post');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const getFlag = (name, fallback) => {
    const arg = args.find((a) => a.startsWith(`--${name}=`));
    return arg ? parseInt(arg.split('=')[1], 10) : fallback;
};
const LIMIT = getFlag('limit', Infinity);
const CONCURRENCY = getFlag('concurrency', 5);
const PROBE_TIMEOUT_MS = 20000;

// ffprobe's own built-in network fetching is unreliable across environments (the
// bundled static binary can crash outright on some remote-URL protocol paths) — so
// download to a temp file first and probe that instead. Slightly more I/O, but works
// everywhere and lets us control timeouts/redirects with a real HTTP client.
async function downloadToTemp(url) {
    const tempPath = path.join(os.tmpdir(), `dimprobe-${crypto.randomBytes(8).toString('hex')}`);
    const response = await axios.get(url, { responseType: 'stream', timeout: PROBE_TIMEOUT_MS });
    await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(tempPath);
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
        response.data.on('error', reject);
    });
    return tempPath;
}

// Mirrors the app's client-side decryptAesGcm (src/lib/cryptoUtils.ts, @noble/ciphers'
// `gcm`) — same AES-256-GCM scheme with the 16-byte auth tag appended to the ciphertext.
// The key/iv already live on the same Post document (mediaKeys/videoKey+videoIv), so
// decrypting here to measure dimensions exposes nothing the server didn't already have.
function decryptAesGcm(encryptedBuffer, base64Key, base64Iv) {
    const key = Buffer.from(base64Key, 'base64');
    const iv = Buffer.from(base64Iv, 'base64');
    const authTag = encryptedBuffer.subarray(encryptedBuffer.length - 16);
    const ciphertext = encryptedBuffer.subarray(0, encryptedBuffer.length - 16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

async function probeDimensions(url, encryption) {
    const downloadedPath = await downloadToTemp(url);
    let decryptedPath = null;
    try {
        let probePath = downloadedPath;
        if (encryption?.key && encryption?.iv) {
            const encryptedBuffer = await fs.promises.readFile(downloadedPath);
            const decrypted = decryptAesGcm(encryptedBuffer, encryption.key, encryption.iv);
            decryptedPath = `${downloadedPath}-dec`;
            await fs.promises.writeFile(decryptedPath, decrypted);
            probePath = decryptedPath;
        }

        return await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(probePath, (err, data) => {
                if (err) return reject(err);
                const stream = (data.streams || []).find((s) => s.width && s.height);
                if (!stream) return reject(new Error('no stream with width/height found'));
                resolve({ width: stream.width, height: stream.height });
            });
        });
    } finally {
        fs.promises.unlink(downloadedPath).catch(() => {});
        if (decryptedPath) fs.promises.unlink(decryptedPath).catch(() => {});
    }
}

const stats = {
    scanned: 0,
    updated: 0,
    imagesProbed: 0,
    imagesFailed: 0,
    videosProbed: 0,
    videosFailed: 0,
};

async function processPost(postId) {
    const post = await Post.findById(postId)
        .select('image_urls image_url video imageDimensions videoDimensions mediaKeys videoKey videoIv');
    if (!post) return;

    stats.scanned++;
    const updates = {};

    const images = (post.image_urls && post.image_urls.length > 0)
        ? post.image_urls
        : (post.image_url ? [post.image_url] : []);

    if (images.length > 0) {
        const existing = Array.isArray(post.imageDimensions) ? post.imageDimensions : [];
        const nextDims = [];
        let changed = existing.length !== images.length;

        for (let i = 0; i < images.length; i++) {
            const current = existing[i];
            if (current && current.width && current.height) {
                nextDims.push({ width: current.width, height: current.height });
                continue;
            }
            changed = true;
            try {
                const mediaKey = post.mediaKeys?.[i];
                const dim = await probeDimensions(images[i], mediaKey);
                nextDims.push(dim);
                stats.imagesProbed++;
            } catch (err) {
                nextDims.push({});
                stats.imagesFailed++;
                console.warn(`  ⚠ image probe failed — post ${post._id} [${i}]: ${err.message}`);
            }
        }
        if (changed) updates.imageDimensions = nextDims;
    }

    if (post.video) {
        const existing = post.videoDimensions;
        if (!existing || !existing.width || !existing.height) {
            try {
                const videoEncryption = post.videoKey && post.videoIv ? { key: post.videoKey, iv: post.videoIv } : null;
                updates.videoDimensions = await probeDimensions(post.video, videoEncryption);
                stats.videosProbed++;
            } catch (err) {
                stats.videosFailed++;
                console.warn(`  ⚠ video probe failed — post ${post._id}: ${err.message}`);
            }
        }
    }

    if (Object.keys(updates).length === 0) return;

    stats.updated++;
    if (!DRY_RUN) {
        await Post.updateOne({ _id: post._id }, { $set: updates });
    }
}

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB connected${DRY_RUN ? ' (dry run — no writes will be made)' : ''}`);

        const query = {
            deletedAt: null,
            $or: [
                {
                    $and: [
                        { $or: [{ image_urls: { $exists: true, $not: { $size: 0 } } }, { image_url: { $ne: null } }] },
                        { $or: [{ imageDimensions: { $exists: false } }, { imageDimensions: { $elemMatch: { width: { $exists: false } } } }] },
                    ],
                },
                {
                    video: { $ne: null },
                    $or: [{ videoDimensions: { $exists: false } }, { 'videoDimensions.width': { $exists: false } }],
                },
            ],
        };

        const candidateIds = (await Post.find(query).select('_id').limit(LIMIT).lean()).map((p) => p._id);
        console.log(`Found ${candidateIds.length} post(s) needing dimension backfill.`);

        const limit = pLimit(CONCURRENCY);
        let done = 0;
        await Promise.all(candidateIds.map((id) => limit(async () => {
            await processPost(id);
            done++;
            if (done % 20 === 0 || done === candidateIds.length) {
                console.log(`  progress: ${done}/${candidateIds.length}`);
            }
        })));

        console.log('\nDone.');
        console.log(`  Posts scanned:   ${stats.scanned}`);
        console.log(`  Posts updated:   ${stats.updated}${DRY_RUN ? ' (dry run, not written)' : ''}`);
        console.log(`  Images probed:   ${stats.imagesProbed} (${stats.imagesFailed} failed)`);
        console.log(`  Videos probed:   ${stats.videosProbed} (${stats.videosFailed} failed)`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Backfill failed:', err);
        process.exit(1);
    }
})();
