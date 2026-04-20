const { connect, StringCodec } = require("nats");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { pipeline } = require("@xenova/transformers");
const { PostVector, UserInterest } = require("./models/Recommendation");
const Post = require("./models/Post");

dotenv.config();

const NATS_URL = process.env.NATS_URL || "wss://7905038@://onrender.com";
const MONGO_URI = process.env.MONGO_URI;

let extractor = null;
const sc = StringCodec();

// Exponential Moving Average factor for user interest updates
const ALPHA = 0.2;

const http = require('http');
// Render automatically provides the PORT environment variable
const dummyPort = process.env.PORT || 10000; 

http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Worker is active');
}).listen(dummyPort, () => {
  console.log(`Dummy health-check server listening on port ${dummyPort}`);
});

async function initWorker() {
    // 1. Connect to MongoDB (if not already connected by main app, though workers usually run standalone)
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(MONGO_URI);
        console.log("📦 Worker connected to MongoDB");
    }

    // 2. Load Embedding Model
    console.log("🧠 Loading Embedding Model (all-MiniLM-L6-v2)...");
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log("✅ Model loaded");

    // 3. Connect to NATS
    const nc = await connect({ servers: "wss://nats-inby.onrender.com", token: "7905038", waitOnFirstConnect: true, timeout: 60000});
    console.log(`🔌 Worker connected to NATS at ${NATS_URL}`);

    // 4. Subscribe to subjects
    const subjects = ["post.created", "user.activity.*"];

   // 4. Subscribe to subjects
const sub = nc.subscribe(">"); 
console.log("📡 Subscribed to all subjects");

(async () => {
  for await (const m of sub) {
    try {
      const subject = m.subject;
      const rawData = sc.decode(m.data);
      const data = JSON.parse(rawData);

      if (subject === "post.created") {
        await handlePostCreated(data);
      } else if (subject.startsWith("user.activity.")) {
        await handleUserActivity(data);
      }
    } catch (err) {
      console.error(`❌ Error processing message:`, err.message);
    }
  }
})().catch(err => console.error("Message loop error:", err));

}

async function getEmbedding(text) {
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

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

async function handleUserActivity(data) {
    const { userId, postId, action, category, tags = [] } = data;
    if (!userId || !postId) return;

    // Get post vector
    let postVecDoc = await PostVector.findOne({ postId });
    if (!postVecDoc) {
        // If not found, try to generate it now
        const post = await Post.findById(postId);
        if (post) {
            const text = `${post.caption} ${post.category} ${(post.tags || []).join(' ')}`.trim();
            const vector = await getEmbedding(text);
            postVecDoc = await PostVector.create({ postId, vector, category: post.category, tags: post.tags || [] });
        }
    }

    if (!postVecDoc) return;

    // Update User Interest Profile
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
        // Update interest vector using EMA: new_vec = (1-alpha)*old_vec + alpha*post_vec
        const newVector = interest.interestVector.map((val, i) =>
            (1 - ALPHA) * val + ALPHA * postVecDoc.vector[i]
        );
        interest.interestVector = newVector;

        // Update tags/categories (unique sets)
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

initWorker().catch(err => {
    console.error("🔥 Worker failed to start:", err);
    process.exit(1);
});
