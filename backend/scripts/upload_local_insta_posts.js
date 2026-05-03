const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Post = require('../models/Post');
const { detectMoodFromCaption } = require('../utils/gemini');
const { checkContent } = require('../middleware/contentFilter');

const CLOUDINARY_URL = "https://cloudinary-service-mdl5.onrender.com/api/cloudinary/upload-base64";

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

        const metaData = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const username = metaData.target_username;
        const fullname = metaData.full_name || username;

        // Check/Create user
        let user = await User.findOne({ username });
        if (!user) {
            console.log(`Creating user: ${username}`);
            user = new User({
                fullname: fullname,
                username: username,
                email: `${username}@instagram.placeholder.com`,
                password: "InstaUserPassword123!", // Placeholder
                authProvider: 'local',
                isEmailVerified: true,
                profile_picture: 'https://img.icons8.com/fluency/96/instagram-new.png'
            });
            await user.save();
            console.log(`User created with ID: ${user._id}`);
        } else {
            console.log(`User already exists: ${username} (ID: ${user._id})`);
        }

        // Iterate posts
        for (const postMeta of metaData.posts) {
            const shortcode = postMeta.shortcode;
            const caption = postMeta.caption;
            const isVideo = postMeta.is_video;

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
                        secureUrl = cUrl || `data:video/mp4;base64,${base64Data}`;
                    }
                } else if (file.endsWith('.jpg')) {
                    if (isVideo && !thumbPath) {
                        thumbPath = filePath;
                        const cUrl = await uploadToCloudinary(base64Data, 'image/jpeg', shortcode);
                        thumbnailUrl = cUrl || `data:image/jpeg;base64,${base64Data}`;
                    } else {
                        const cUrl = await uploadToCloudinary(base64Data, 'image/jpeg', shortcode);
                        image_urls.push(cUrl || `data:image/jpeg;base64,${base64Data}`);
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

            // // ─── CONTENT FILTERING ───
            // const violation = await checkContent(caption);
            // if (violation && violation.action === 'block') {
            //     console.warn(`Post ${shortcode} blocked due to violation: ${violation.word}. Skipping.`);
            //     continue;
            // }

            // // ─── MOOD DETECTION ───
            // const detectedMood = await detectMoodFromCaption(caption || 'Captivating moment');
            // console.log(`Detected mood: ${detectedMood}`);

            // Create Post in MongoDB
            const newPost = new Post({
                caption: caption && caption.length > 500 ? caption.substring(0, 497) + '...' : caption,
                category: 'Default',
                // mood: detectedMood,
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

            // if (violation && violation.action === 'flag') {
            //     newPost.isFlagged = true;
            //     newPost.flagReason = `Automated filter: ${violation.word}`;
            // }

            await newPost.save();
            console.log(`Post created successfully for ${shortcode} (ID: ${newPost._id})`);

            // ─── POST-UPLOAD SYNC (Normal Upload Process) ───
            try {
                const { publish } = require('../lib/pubsub');
                const { publishEvent } = require('../services/recommendationPublisher');

                // 1. Pusher publish
                await publish('posts.created', { 
                    id: newPost._id, 
                    user: newPost.user, 
                    category: newPost.category 
                }).catch(err => console.warn('[Pusher Sync]:', err.message));

                // 2. Recommendation Event publish
                await publishEvent("post.created", {
                    postId: newPost._id.toString(),
                    userId: user._id.toString(),
                    caption: newPost.caption || "",
                    category: newPost.category || "Default",
                    tags: newPost.tags || [],
                    mood: newPost.mood ,
                    likesCount: 0,
                    savesCount: 0,
                    viewsCount: 0,
                    sharesCount: 0,
                    createdAtTs: Math.floor(new Date(newPost.createdAt).getTime() / 1000),
                }).catch(err => console.warn('[NATS Sync]:', err.message));

                // console.log(`Post ${shortcode} synced with Recommendation engine.`);
            } catch (syncErr) {
                console.warn(`Sync failed for ${shortcode}:`, syncErr.message);
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
