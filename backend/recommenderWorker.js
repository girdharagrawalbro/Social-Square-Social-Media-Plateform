const { connect, StringCodec } = require("nats");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PostVector, UserInterest } = require("./models/Recommendation");
const Post = require("./models/Post");
const http = require('http');

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });

// Configuration
const NATS_URL = process.env.NATS_URL || "wss://://onrender.com";
const MONGO_URI = process.env.MONGO_URI;
const NATS_TOKEN = "7905038";
const ALPHA = 0.2; // EMA factor for user interest

let extractor = null;
const sc = StringCodec();

// 1. HEALTH CHECK SERVER (Required for Render Free Tier)
const dummyPort = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Worker is active');
}).listen(dummyPort, () => {
  console.log(`🚀 Health-check server listening on port ${dummyPort}`);
});

// 2. EMBEDDING HELPER
async function getEmbedding(text) {
  const result = await model.embedContent({
    content: { parts: [{ text }] },
    outputDimensionality: 384
  });
  return result.embedding.values;
}

// 3. POST CREATED HANDLER
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

// 4. USER ACTIVITY HANDLER
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

  let currentAlpha = ALPHA; // default 0.2
  let shouldUpdateTags = true;

  if (action === 'not_interested') {
    currentAlpha = -0.15; // Push away
    shouldUpdateTags = false;
  } else if (action === 'interested') {
    currentAlpha = 0.3; // Strong pull
  } else if (action === 'like' || action === 'save' || action === 'share') {
    currentAlpha = 0.2; // Normal pull
  } else if (action === 'view') {
    currentAlpha = 0.05; // Weak pull
  }

  if (!interest) {
    if (action === 'not_interested') return; // Do not create a new profile just to push away

    interest = new UserInterest({
      userId,
      interestVector: postVecDoc.vector,
      likedTags: tags,
      topCategories: category ? [category] : []
    });
  } else {
    // Math.abs ensures we scale the existing vector properly while currentAlpha determines the pull/push direction
    const newVector = interest.interestVector.map((val, i) =>
      (1 - Math.abs(currentAlpha)) * val + currentAlpha * postVecDoc.vector[i]
    );
    interest.interestVector = newVector;

    if (shouldUpdateTags) {
      if (tags.length > 0) {
        interest.likedTags = [...new Set([...interest.likedTags, ...tags])].slice(-20);
      }
      if (category && !interest.topCategories.includes(category)) {
        interest.topCategories = [category, ...interest.topCategories.filter(c => c !== category)].slice(0, 5);
      }
    } else if (action === 'not_interested') {
      // If they are not interested, we can optionally remove these tags from their liked tags
      if (tags.length > 0) {
        interest.likedTags = interest.likedTags.filter(t => !tags.includes(t));
      }
    }
  }

  interest.lastUpdated = new Date();
  await interest.save();
  console.log(`✅ User ${userId} profile updated (${action})`);
}

// 5. MAIN WORKER INIT
async function initWorker() {
  // Database
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
    console.log("📦 Connected to MongoDB");
  }

  // AI Model is now handled externally via Gemini API
  console.log("✅ AI Model ready (using Gemini API)");

  // NATS Connection
  try {
    const nc = await connect({
      servers: NATS_URL,
      token: NATS_TOKEN,
      waitOnFirstConnect: true,
      timeout: 60000
    });
    console.log(`🔌 Connected to NATS at ${NATS_URL}`);

    const sub = nc.subscribe(">");

    (async () => {
      for await (const m of sub) {
        try {
          const subject = m.subject;
          const data = JSON.parse(sc.decode(m.data));
          const rid = data.requestId ? ` [${data.requestId}]` : '';

          if (rid) {
            // If we had a logger, we would use AsyncLocalStorage here. 
            // For console.log, we just prefix.
          }

          if (subject === "post.created") {
            console.log(`📝${rid} Processing post.created for ${data.postId}`);
            await handlePostCreated(data);
          } else if (subject.startsWith("user.activity.")) {
            console.log(`👤${rid} Processing user.activity for ${data.userId}`);
            await handleUserActivity(data);
          }
        } catch (err) {
          console.error(`❌ Message processing error:`, err.message);
        }
      }
    })().catch(err => console.error("Subscription loop error:", err));

  } catch (err) {
    console.error("❌ NATS Connection failed:", err);
  }
}

// Start
initWorker().catch(err => {
  console.error("🔥 Worker failed to start:", err);
  process.exit(1);
});
