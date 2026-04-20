const { connect, StringCodec } = require("nats");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { pipeline } = require("@xenova/transformers");
const { PostVector, UserInterest } = require("./models/Recommendation");
const Post = require("./models/Post");
const http = require('http');

dotenv.config();

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
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
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

  if (!interest) {
    interest = new UserInterest({ 
      userId, 
      interestVector: postVecDoc.vector, 
      likedTags: tags, 
      topCategories: category ? [category] : [] 
    });
  } else {
    const newVector = interest.interestVector.map((val, i) => 
      (1 - ALPHA) * val + ALPHA * postVecDoc.vector[i]
    );
    interest.interestVector = newVector;

    if (tags.length > 0) {
      interest.likedTags = [...new Set([...interest.likedTags, ...tags])].slice(-20);
    }
    if (category && !interest.topCategories.includes(category)) {
      interest.topCategories = [category, ...interest.topCategories.filter(c => c !== category)].slice(0, 5);
    }
  }

  interest.lastUpdated = new Date();
  await interest.save();
  console.log(`✅ User ${userId} profile updated`);
}

// 5. MAIN WORKER INIT
async function initWorker() {
  // Database
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
    console.log("📦 Connected to MongoDB");
  }

  // AI Model
  console.log("🧠 Loading Embedding Model (all-MiniLM-L6-v2)...");
  extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log("✅ AI Model ready");

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

          if (subject === "post.created") {
            await handlePostCreated(data);
          } else if (subject.startsWith("user.activity.")) {
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
