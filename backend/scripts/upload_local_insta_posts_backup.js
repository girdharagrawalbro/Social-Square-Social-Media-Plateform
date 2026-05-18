const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Post = require('../models/Post');
const { updateGamification } = require('../lib/gamification');
const { checkContent } = require('../middleware/contentFilter');

const CLOUDINARY_URL = "http://localhost:5001/api/cloudinary/upload-base64";
const OLLAMA_URL = "http://localhost:11434/api/generate";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:3b"; // Try qwen2.5:3b.1 as a common default

async function detectMoodOllama(caption) {
    if (!caption || !String(caption).trim()) return 'neutral';
    try {
        const prompt = `Analyze the mood of this social media post caption and return ONLY one word from this list: happy, sad, excited, angry, calm, romantic, funny, inspirational, nostalgic, neutral\n\nCaption: "${caption}"\n\nReturn only the single mood word, nothing else.`;

        const response = await axios.post(OLLAMA_URL, {
            model: OLLAMA_MODEL,
            prompt: prompt,
            stream: false
        }, { timeout: 15000 });

        const mood = response.data.response.trim().toLowerCase().replace(/[^\w]/g, '');
        const validMoods = ['happy', 'sad', 'excited', 'angry', 'calm', 'romantic', 'funny', 'inspirational', 'nostalgic', 'neutral'];
        return validMoods.includes(mood) ? mood : 'neutral';
    } catch (err) {
        if (err.response) {
            console.warn(`[Ollama] Error ${err.response.status}: ${JSON.stringify(err.response.data)}`);
        } else {
            console.warn(`[Ollama] Failed: ${err.message}`);
        }
        return 'neutral';
    }
}

async function uploadToCloudinary(base64Data, mimeType, shortcode) {
    try {
        console.log(`Uploading to Cloudinary...`);
        const resourceType = mimeType.startsWith('video/') ? 'video' : 'image';
        const cloudRes = await axios.post(
            CLOUDINARY_URL,
            {
                file: `data:${mimeType};base64,${base64Data}`,
                resourceType: resourceType
            },
            {
                headers: { 'Content-Type': 'application/json' },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 600000 // 10 minutes
            }
        );

        if (cloudRes.data && cloudRes.data.data && cloudRes.data.data.secure_url) {
            return cloudRes.data.data.secure_url;
        } else {
            console.error(`Cloudinary returned unexpected payload for ${shortcode}.`, cloudRes.data);
            return null;
        }
    } catch (err) {
        if (err.response) {
            console.error(`Cloudinary API error for ${shortcode}:`, err.message, err.response.data);
        } else {
            console.error(`Cloudinary API error for ${shortcode}:`, err.message);
        }
        return null;
    }
}
async function run() {
    const folderArg = process.argv[2];
    if (!folderArg) {
        console.error("Usage: node upload_local_insta_posts.js <path_to_posts_folder>");
        process.exit(1);
    }

    const postsDir = path.resolve(folderArg);
    const metaPath = path.join(postsDir, 'metadata.json');

    if (!fs.existsSync(metaPath)) {
        console.error(`metadata.json not found in provided directory: ${postsDir}`);
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/socialsquare');
        console.log("MongoDB Connected.");

        // 🔍 Check Ollama Models
        try {
            const ollamaCheck = await axios.get("http://localhost:11434/api/tags", { timeout: 3000 });
            if (ollamaCheck.data && ollamaCheck.data.models) {
                const models = ollamaCheck.data.models.map(m => m.name);
                console.log(`[Ollama] Available local models: ${models.join(', ')}`);
                if (!models.includes(OLLAMA_MODEL) && !models.includes(`${OLLAMA_MODEL}:latest`)) {
                    console.warn(`[Ollama] Warning: Model "${OLLAMA_MODEL}" not found in your local Ollama. Please run "ollama pull ${OLLAMA_MODEL}" or set OLLAMA_MODEL in .env`);
                }
            }
        } catch (e) {
            console.warn(`[Ollama] Could not connect to local Ollama server at http://localhost:11434. Mood detection will be disabled.`);
        }

        const metaData = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const username = metaData.profile.username;
        const fullname = metaData.profile.fullName || username;

        // Check/Create user
        let user = await User.findOne({ username });
        if (!user) {
            console.log(`Creating user: ${username}`);
            user = new User({
                fullname: fullname,
                username: username,
                email: `${username}@gmail.com`,
                password: "InstaUserPassword123!", // Placeholder
                authProvider: 'local',
                isEmailVerified: true,
                profile_picture: 'https://img.icons8.com/fluency/96/instagram-new.png',
                bio: metaData.profile.biography || ""
            });
            await user.save();
            console.log(`User created with ID: ${user._id}`);
        } else {
            console.log(`User already exists: ${username} (ID: ${user._id})`);
        }

        // Handle profile picture update if profile_pic.jpg exists
        const profilePicPath = path.join(postsDir, 'profile_pic.jpg');
        if (fs.existsSync(profilePicPath)) {
            console.log(`Found profile picture for ${username}, uploading...`);
            const pb = fs.readFileSync(profilePicPath);
            const pUrl = await uploadToCloudinary(pb.toString('base64'), 'image/jpeg', `${username}_profile`);
            if (pUrl) {
                user.profile_picture = pUrl;
                await user.save();
                console.log(`User profile picture updated to: ${pUrl}`);

                // Synchronize profile picture in all existing posts for this user
                const postUpdateResult = await Post.updateMany(
                    { 'user._id': user._id },
                    { $set: { 'user.profile_picture': pUrl } }
                );
                console.log(`Synchronized profile picture in ${postUpdateResult.modifiedCount} existing posts for ${username}.`);
            }
        }

        // Iterate posts
        for (const postMeta of metaData.items || []) {
            const shortcode = postMeta.shortcode;
            const caption = postMeta.caption;
            const isVideo = postMeta.type === 'Video';

            console.log(`Processing post ${shortcode}...`);

            let secureUrl = null;
            let thumbnailUrl = null;
            let image_urls = [];

            // Find all files matching this shortcode
            const files = fs.readdirSync(postsDir).filter(f => f.startsWith(shortcode));

            // Sort files naturally (e.g. XYZ_1.jpg, XYZ_2.jpg)
            files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

            let videoPath = null;
            let thumbPath = null;

            for (const file of files) {
                const filePath = path.join(postsDir, file);
                const fileBuffer = fs.readFileSync(filePath);
                const base64Data = fileBuffer.toString('base64');

                if (file.endsWith('.mp4')) {
                    if (!videoPath) {
                        videoPath = filePath;
                        const cUrl = await uploadToCloudinary(base64Data, 'video/mp4', shortcode);
                        if (!cUrl) {
                            console.error(`Failed to upload video for ${shortcode}. Skipping post to avoid DB size limits.`);
                            secureUrl = null;
                            break; // Skip this post
                        }
                        secureUrl = cUrl;
                    }
                } else if (file.endsWith('.jpg')) {
                    if (isVideo && !thumbPath) {
                        thumbPath = filePath;
                        const cUrl = await uploadToCloudinary(base64Data, 'image/jpeg', shortcode);
                        if (cUrl) thumbnailUrl = cUrl;
                    } else {
                        const cUrl = await uploadToCloudinary(base64Data, 'image/jpeg', shortcode);
                        if (cUrl) image_urls.push(cUrl);
                        else console.warn(`Failed to upload image part for ${shortcode}. Skipping this image.`);
                    }
                }
            }

            if (!isVideo && image_urls.length > 0) {
                secureUrl = image_urls[0];
            }

            if (!secureUrl && image_urls.length === 0) {
                console.warn(`Media files not found for post ${shortcode}, skipping...`);
                continue;
            }

            // ─── CONTENT FILTERING ───
            const violation = await checkContent(caption);
            if (violation && violation.action === 'block') {
                console.warn(`Post ${shortcode} blocked due to violation: ${violation.word}. Skipping.`);
                continue;
            }

            // ─── MOOD DETECTION (Ollama) ───
            const detectedMood = await detectMoodOllama(caption || 'Captivating moment');
            console.log(`Detected mood (Ollama): ${detectedMood}`);

            // Create Post in MongoDB
            const newPost = new Post({
                caption: caption && caption.length > 500 ? caption.substring(0, 497) + '...' : caption,
                category: 'Default',
                mood: detectedMood,
                image_urls: image_urls,
                video: isVideo ? secureUrl : null,
                videoThumbnail: isVideo ? thumbnailUrl : null,
                user: {
                    _id: user._id,
                    fullname: user.fullname,
                    profile_picture: user.profile_picture
                },
                createdAt: postMeta.date_utc ? new Date(postMeta.date_utc) : new Date()
            });

            if (violation && violation.action === 'flag') {
                newPost.isFlagged = true;
                newPost.flagReason = `Automated filter: ${violation.word}`;
            }

            await newPost.save();
            console.log(`Post created successfully for ${shortcode} (ID: ${newPost._id})`);

            // ─── POST-UPLOAD SYNC & GAMIFICATION ───
            try {
                const { publish } = require('../lib/pubsub');
                const { publishEvent } = require('../services/recommendationPublisher');

                // 1. NATS/Pusher publish
                await publish('posts.created', {
                    id: newPost._id,
                    user: newPost.user,
                    category: newPost.category
                }).catch(err => console.warn('[PubSub Sync]:', err.message));

                // 2. Recommendation Event publish
                await publishEvent("post.created", {
                    postId: newPost._id.toString(),
                    userId: user._id.toString(),
                    caption: newPost.caption || "",
                    category: newPost.category || "Default",
                    tags: newPost.tags || [],
                    mood: newPost.mood,
                    likesCount: 0,
                    savesCount: 0,
                    viewsCount: 0,
                    sharesCount: 0,
                    createdAtTs: Math.floor(new Date(newPost.createdAt).getTime() / 1000),
                }).catch(err => console.warn('[NATS Sync]:', err.message));

                // 3. Update Gamification (Post Reward)
                const rewards = await updateGamification(user._id, 'post');
                if (rewards) {
                    console.log(`Gamification updated. XP Gained: ${rewards.xpGain}, Total XP: ${rewards.totalXp}, Level: ${rewards.level}`);
                }

            } catch (syncErr) {
                console.warn(`Post-upload sync failed for ${shortcode}:`, syncErr.message);
            }
        }

        console.log("\n========================================");
        console.log("✅ Batch post upload completed successfully.");
        console.log("========================================");
        await mongoose.disconnect();
    } catch (e) {
        console.error("Pipeline execution error:", e);
        await mongoose.disconnect();
    }
}

run();
