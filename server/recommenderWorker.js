const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { PostVector, UserInterest, CommentVector, VideoStats } = require("./models/Recommendation");
const Post = require("./models/Post");
const Comment = require("./models/Comment");
const { getEmbedding } = require("./utils/embeddings");
const { updateTagCooccurrence } = require("./utils/tagGraph");

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// P1 — Dwell-time-aware EMA alpha computation
// The alpha controls how strongly a new post shifts the user's interest vector.
// Higher alpha = stronger pull toward this post's embedding.
// Negative alpha = push away (not_interested signal).
// ─────────────────────────────────────────────────────────────────────────────
function computeAlpha(action, durationSec = 0) {
  switch (action) {
    case 'not_interested': return -0.15;
    case 'like': return 0.25;
    case 'save': return 0.30;
    case 'share': return 0.28;
    case 'comment': return 0.22;
    case 'interested': return 0.30;

    // P9b — Video watch-time granular alpha
    case 'video_watch':
      if (durationSec >= 30) return 0.25; // Watched most of a reel
      if (durationSec >= 10) return 0.15;
      if (durationSec >= 3) return 0.08;
      return 0.02; // Quick scroll-past

    // P1 — Text/image dwell-time alpha
    case 'view':
      if (durationSec >= 15) return 0.18; // Deep read
      if (durationSec >= 5) return 0.10;
      if (durationSec >= 2) return 0.05;
      return 0.01; // Glance

    default: return 0.05;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// P7a — Track which hour of the day (0-23) this user is active
// Keeps a rolling window of the last 24 distinct active hours (deduplicated)
// ─────────────────────────────────────────────────────────────────────────────
function updateActiveHours(interest) {
  const currentHour = new Date().getHours(); // 0-23 local server hour
  const hours = interest.activeHours || [];
  if (!hours.includes(currentHour)) {
    interest.activeHours = [...hours, currentHour].slice(-24);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST CREATED HANDLER — Generate and store embedding for a new post
// ─────────────────────────────────────────────────────────────────────────────
async function handlePostCreated(data) {
  const { postId, caption, category, tags = [] } = data;
  const textToEmbed = `${caption} ${category} ${tags.join(' ')}`.trim();

  console.log(`📝 Generating embedding for post ${postId}...`);
  const vector = await getEmbedding(textToEmbed);

  await PostVector.findOneAndUpdate(
    { postId },
    { vector, category, tags, createdAt: new Date() },
    { new: true, upsert: true }
  );
  console.log(` Post ${postId} embedded`);
}

// ─────────────────────────────────────────────────────────────────────────────
// USER ACTIVITY HANDLER
// Handles: like, save, share, view, comment, not_interested, video_watch
// ─────────────────────────────────────────────────────────────────────────────
async function handleUserActivity(data) {
  const { userId, postId, action, category, tags = [], duration = 0, videoLength = 0 } = data;
  if (!userId || !postId) return;

  // Ensure post has an embedding
  let postVecDoc = await PostVector.findOne({ postId });

  if (!postVecDoc) {
    const post = await Post.findById(postId);
    if (post) {
      const text = `${post.caption} ${post.category} ${(post.tags || []).join(' ')}`.trim();
      const vector = await getEmbedding(text);
      postVecDoc = await PostVector.create({
        postId,
        vector,
        category: post.category,
        tags: post.tags || []
      });
    }
  }

  if (!postVecDoc) return;

  // ── P9b: Update VideoStats for video_watch actions ──────────────────────
  if (action === 'video_watch' && duration > 0) {
    try {
      const isCompletion = videoLength > 0 && duration >= videoLength * 0.8;
      const updatedStats = await VideoStats.findOneAndUpdate(
        { postId },
        {
          $inc: {
            totalViews: 1,
            totalWatchTimeSec: duration,
            ...(isCompletion ? { completionCount: 1 } : {})
          },
          $set: { updatedAt: new Date() }
        },
        { new: true, upsert: true }
      );
      if (updatedStats && updatedStats.totalViews > 0) {
        updatedStats.avgWatchTimeSec = updatedStats.totalWatchTimeSec / updatedStats.totalViews;
        updatedStats.watchThroughRate = updatedStats.completionCount / updatedStats.totalViews;
        await updatedStats.save();
      }
    } catch (vsErr) {
      console.warn(`⚠️ [Recommender Worker] VideoStats update failed for ${postId}:`, vsErr.message);
    }
  }

  // ── P10b: Update tag co-occurrence graph on positive interactions ────────
  const positiveActions = new Set(['like', 'save', 'share', 'comment', 'video_watch', 'interested']);
  if (positiveActions.has(action) && tags.length >= 2) {
    try {
      const redis = require('./lib/redis');
      updateTagCooccurrence(tags, redis).catch(() => { });
    } catch (_) { }
  }

  // ── EMA Interest Vector Update ───────────────────────────────────────────
  console.log(`👤 Updating interest profile for user ${userId} (${action}, dwell=${duration}s)...`);
  const currentAlpha = computeAlpha(action, duration);
  const shouldUpdateTags = action !== 'not_interested';

  let interest = await UserInterest.findOne({ userId });

  if (!interest) {
    if (action === 'not_interested') return;

    interest = new UserInterest({
      userId,
      interestVector: postVecDoc.vector,
      likedTags: tags,
      topCategories: category ? [category] : [],
      // P5b: initialize behavioral stats
      avgDwellTimeSec: duration,
      totalInteractions: 1,
      preferredContentType: action === 'video_watch' ? 'video' : 'mixed',
      activeHours: [new Date().getHours()],
      dislikedCategories: [],
    });
  } else {
    // ── Update EMA interest vector ─────────────────────────────────────────
    if (interest.interestVector.length !== postVecDoc.vector.length) {
      console.warn(`⚠️ Vector dimension mismatch for user ${userId}: stored=${interest.interestVector.length}, new=${postVecDoc.vector.length}. Resetting.`);
      interest.interestVector = postVecDoc.vector;
    } else {
      interest.interestVector = interest.interestVector.map((val, i) => {
        const updated = (1 - Math.abs(currentAlpha)) * val + currentAlpha * (postVecDoc.vector[i] ?? 0);
        return Number.isFinite(updated) ? updated : val;
      });
    }

    // ── Update tags & categories ───────────────────────────────────────────
    if (shouldUpdateTags) {
      if (tags.length > 0) {
        interest.likedTags = [...new Set([...interest.likedTags, ...tags])].slice(-20);
      }
      if (category && !interest.topCategories.includes(category)) {
        interest.topCategories = [category, ...interest.topCategories.filter(c => c !== category)].slice(0, 5);
      }
    } else if (action === 'not_interested') {
      // Remove disliked tags and track disliked category
      if (tags.length > 0) {
        interest.likedTags = interest.likedTags.filter(t => !tags.includes(t));
      }
      if (category && !(interest.dislikedCategories || []).includes(category)) {
        interest.dislikedCategories = [...(interest.dislikedCategories || []), category].slice(-10);
      }
    }

    // ── P5b: Update behavioral statistics ─────────────────────────────────
    const n = (interest.totalInteractions || 0) + 1;
    interest.totalInteractions = n;

    // Rolling average dwell time
    if (duration > 0) {
      interest.avgDwellTimeSec = ((interest.avgDwellTimeSec || 0) * (n - 1) + duration) / n;
    }

    // P9b: Update video completion rate for user
    if (action === 'video_watch') {
      interest.videoWatchCount = (interest.videoWatchCount || 0) + 1;
      const isCompletion = videoLength > 0 && duration >= videoLength * 0.8;
      if (isCompletion) {
        interest.videoCompletionCount = (interest.videoCompletionCount || 0) + 1;
      }
      if (interest.videoWatchCount > 0) {
        interest.videoCompletionRate = interest.videoCompletionCount / interest.videoWatchCount;
      }
      // Detect preference for video content
      const videoRatio = interest.videoWatchCount / Math.max(1, interest.totalInteractions);
      interest.preferredContentType = videoRatio > 0.5 ? 'video' : videoRatio > 0.25 ? 'mixed' : interest.preferredContentType;
    }

    // P7a: Track active hour
    updateActiveHours(interest);
  }

  // ── Exponential Backoff for VersionError (Optimistic Concurrency) ────────
  let retries = 5;
  while (retries > 0) {
    try {
      interest.lastUpdated = new Date();
      await interest.save();
      console.log(` User ${userId} profile updated (${action})`);
      break;
    } catch (err) {
      if (err.name === 'VersionError' && retries > 1) {
        retries--;
        const delay = Math.floor(Math.random() * 50) + 50; // Jittered 50-100ms
        console.warn(`⚠️ [Recommender Worker] VersionError for user ${userId}. Retrying in ${delay}ms... (${retries} left)`);
        await new Promise(r => setTimeout(r, delay));

        const freshInterest = await UserInterest.findOne({ userId });
        if (!freshInterest) break;
        // Re-apply all changes to the freshly fetched document
        freshInterest.interestVector = interest.interestVector;
        freshInterest.likedTags = interest.likedTags;
        freshInterest.topCategories = interest.topCategories;
        freshInterest.dislikedCategories = interest.dislikedCategories;
        freshInterest.avgDwellTimeSec = interest.avgDwellTimeSec;
        freshInterest.totalInteractions = interest.totalInteractions;
        freshInterest.preferredContentType = interest.preferredContentType;
        freshInterest.activeHours = interest.activeHours;
        freshInterest.videoWatchCount = interest.videoWatchCount;
        freshInterest.videoCompletionCount = interest.videoCompletionCount;
        freshInterest.videoCompletionRate = interest.videoCompletionRate;
        interest = freshInterest;
      } else {
        throw err;
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN WORKER INIT — Subscribes to local EventBus events
// ─────────────────────────────────────────────────────────────────────────────
async function initWorker() {
  console.log("[Worker] Initializing integrated Recommender Worker...");
  console.log("[Worker] AI Model ready (using Gemini API)");

  const eventBus = require('./lib/eventBus');

  eventBus.on("post.created", async (data) => {
    try {
      const rid = data.requestId ? ` [${data.requestId}]` : '';
      console.log(`${rid} [Recommender Worker] Processing post.created for ${data.postId || data.id}`);
      await handlePostCreated({
        postId: data.postId || data.id,
        caption: data.caption || "",
        category: data.category || "",
        tags: data.tags || []
      });
    } catch (err) {
      console.error(`[Recommender Worker] Error processing post.created:`, err.message);
    }
  });

  eventBus.on("user.activity.*", async (subject, data) => {
    try {
      const rid = data.requestId ? ` [${data.requestId}]` : '';
      console.log(`${rid} [Recommender Worker] Processing "${subject}" for user ${data.userId}`);
      await handleUserActivity(data);
    } catch (err) {
      console.error(`[Recommender Worker] Error processing activity "${subject}":`, err.message);
    }
  });

  eventBus.on("comment.created", async (data) => {
    try {
      const { commentId, postId, content, topic } = data;
      console.log(`[Recommender Worker] Processing comment.created for ${commentId}`);

      const vector = await getEmbedding(content);
      if (vector && vector.length > 0) {
        await CommentVector.findOneAndUpdate(
          { commentId },
          { postId, vector, topic: topic || 'General', createdAt: new Date() },
          { new: true, upsert: true }
        );
        console.log(`Comment ${commentId} embedded`);
      }
    } catch (err) {
      console.error(`[Recommender Worker] Error processing comment.created:`, err.message);
    }
  });

  console.log("[Recommender Worker] Recommender Worker subscribed to local EventBus");
}

module.exports = { initWorker };
