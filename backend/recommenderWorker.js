const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PostVector, UserInterest } = require("./models/Recommendation");
const Post = require("./models/Post");

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

const ALPHA = 0.2; // EMA factor for user interest

// 1. EMBEDDING HELPER WITH EXPONENTIAL BACKOFF RETRY
async function getEmbedding(text, retries = 5, initialDelay = 1500) {
  let delay = initialDelay;
  for (let i = 0; i < retries; i++) {
    try {
      const result = await model.embedContent({
        content: { parts: [{ text }] },
        outputDimensionality: 384
      });
      return result.embedding.values;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`⚠️ [Gemini API] Embedding failed (attempt ${i + 1}/${retries}): ${err.message}. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

// 2. POST CREATED HANDLER
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
  console.log(`✅ Post ${postId} embedded`);
}

// 3. USER ACTIVITY HANDLER
async function handleUserActivity(data) {
  const { userId, postId, action, category, tags = [] } = data;
  if (!userId || !postId) return;

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

  console.log(`👤 Updating interest profile for user ${userId} (${action})...`);
  let interest = await UserInterest.findOne({ userId });

  let currentAlpha = ALPHA;
  let shouldUpdateTags = true;

  if (action === 'not_interested') {
    currentAlpha = -0.15;
    shouldUpdateTags = false;
  } else if (action === 'interested') {
    currentAlpha = 0.3;
  } else if (action === 'like' || action === 'save' || action === 'share') {
    currentAlpha = 0.2;
  } else if (action === 'view') {
    currentAlpha = 0.05;
  }

  if (!interest) {
    if (action === 'not_interested') return;

    interest = new UserInterest({
      userId,
      interestVector: postVecDoc.vector,
      likedTags: tags,
      topCategories: category ? [category] : []
    });
  } else {
    if (interest.interestVector.length !== postVecDoc.vector.length) {
      console.warn(`⚠️ Vector dimension mismatch for user ${userId}: stored=${interest.interestVector.length}, new=${postVecDoc.vector.length}. Resetting interest vector.`);
      interest.interestVector = postVecDoc.vector;
    } else {
      const newVector = interest.interestVector.map((val, i) => {
        const updated = (1 - Math.abs(currentAlpha)) * val + currentAlpha * (postVecDoc.vector[i] ?? 0);
        return Number.isFinite(updated) ? updated : val;
      });
      interest.interestVector = newVector;
    }

    if (shouldUpdateTags) {
      if (tags.length > 0) {
        interest.likedTags = [...new Set([...interest.likedTags, ...tags])].slice(-20);
      }
      if (category && !interest.topCategories.includes(category)) {
        interest.topCategories = [category, ...interest.topCategories.filter(c => c !== category)].slice(0, 5);
      }
    } else if (action === 'not_interested') {
      if (tags.length > 0) {
        interest.likedTags = interest.likedTags.filter(t => !tags.includes(t));
      }
    }
  }

  // Exponential Backoff for Mongoose Optimistic Concurrency (VersionError)
  let retries = 5;
  while (retries > 0) {
    try {
      interest.lastUpdated = new Date();
      await interest.save();
      console.log(`✅ User ${userId} profile updated (${action})`);
      break;
    } catch (err) {
      if (err.name === 'VersionError' && retries > 1) {
        retries--;
        const delay = Math.floor(Math.random() * 50) + 50; // Jittered 50-100ms
        console.warn(`⚠️ [Recommender Worker] VersionError for user ${userId}. Retrying in ${delay}ms... (${retries} retries left)`);
        await new Promise(r => setTimeout(r, delay));
        
        // Refetch the document and re-apply changes
        const freshInterest = await UserInterest.findOne({ userId });
        if (!freshInterest) break;
        freshInterest.interestVector = interest.interestVector;
        freshInterest.likedTags = interest.likedTags;
        freshInterest.topCategories = interest.topCategories;
        interest = freshInterest;
      } else {
        throw err;
      }
    }
  }
}

// 4. MAIN WORKER INIT EXPORTED FOR MAIN SERVER
async function initWorker() {
  console.log("⚡ Initializing integrated Recommender Worker...");
  console.log("✅ AI Model ready (using Gemini API)");

  const eventBus = require('./lib/eventBus');

  // Subscribe to in-memory events instead of Redis Pub/Sub
  eventBus.on("post.created", async (data) => {
    try {
      const rid = data.requestId ? ` [${data.requestId}]` : '';
      console.log(`📝${rid} [Recommender Worker] Processing post.created for ${data.postId || data.id}`);
      await handlePostCreated({
        postId: data.postId || data.id,
        caption: data.caption || "",
        category: data.category || "",
        tags: data.tags || []
      });
    } catch (err) {
      console.error(`❌ [Recommender Worker] Error processing post.created:`, err.message);
    }
  });

  eventBus.on("user.activity.*", async (subject, data) => {
    try {
      const rid = data.requestId ? ` [${data.requestId}]` : '';
      console.log(`👤${rid} [Recommender Worker] Processing activity "${subject}" for user ${data.userId}`);
      await handleUserActivity(data);
    } catch (err) {
      console.error(`❌ [Recommender Worker] Error processing activity event "${subject}":`, err.message);
    }
  });

  console.log("🔌 Recommender Worker subscribed to local EventBus");
}

module.exports = { initWorker };
