/**
 * ULTRA OPTIMIZED INSTAGRAM IMPORTER
 *
 * Improvements:
 * ✅ Parallel processing with concurrency control
 * ✅ Single AI call for mood + category + tags
 * ✅ Parallel Cloudinary uploads
 * ✅ Bulk Mongo inserts
 * ✅ Bulk category creation
 * ✅ Removed artificial delays
 * ✅ Async filesystem operations
 * ✅ Faster hashtag-first classification
 * ✅ Reduced Ollama token usage
 * ✅ Lower RAM usage
 * ✅ Better error handling
 * ✅ Faster user updates
 *
 * INSTALL:
 * npm i p-limit
 *
 * RUN:
 * node scripts/upload_local_insta_posts.js ./posts_folder
 */

const mongoose = require('mongoose');
const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');
const pLimit = require('p-limit');

dotenv.config({
    path: path.join(__dirname, '../.env')
});

const User = require('../models/User');
const Post = require('../models/Post');
const Category = require('../models/Category');

const { updateGamification } = require('../lib/gamification');
const { checkContent } = require('../middleware/contentFilter');

const CLOUDINARY_URL =
    (process.env.CLOUDINARY_API_BASE_URL || 'https://cloudinary-service-mdl5.onrender.com/api/cloudinary').replace(/\/+$/, '') + '/upload-base64';

const OLLAMA_URL =
    'http://localhost:11434/api/generate';

const OLLAMA_MODEL =
    process.env.OLLAMA_MODEL || 'qwen2.5:3b';

const CONCURRENCY =
    Number(process.env.IMPORT_CONCURRENCY || 2);

const UPLOAD_CONCURRENCY = 3;

const AI_TIMEOUT = 60000;

const BULK_SIZE = 25;

function cleanAndParseJson(text) {
    try {
        if (!text) return null;

        let cleanText = text.trim();

        cleanText = cleanText
            .replace(/^```json/i, '')
            .replace(/^```/, '')
            .replace(/```$/, '')
            .trim();

        return JSON.parse(cleanText);
    } catch {
        return null;
    }
}

/**
 * FAST LOCAL HASHTAG CLASSIFIER
 * Avoids unnecessary AI calls
 */
function localClassify(caption = '', tags = []) {
    const text =
        `${caption} ${tags.join(' ')}`.toLowerCase();

    const keywordMap = {
        Travel: ['travel', 'trip', 'vacation', 'beach'],
        Food: ['food', 'pizza', 'burger', 'recipe'],
        Gaming: ['gaming', 'pubg', 'valorant'],
        Tech: ['ai', 'tech', 'coding', 'react'],
        Fitness: ['gym', 'workout', 'fitness'],
        Fashion: ['fashion', 'outfit', 'style'],
        Music: ['music', 'song', 'dj'],
        Dance: ['dance', 'dancing'],
        Comedy: ['funny', 'meme', 'joke']
    };

    for (const [category, words] of Object.entries(
        keywordMap
    )) {
        for (const word of words) {
            if (text.includes(word)) {
                return {
                    mood: 'Energetic',
                    category,
                    tags: [...new Set([...tags, word])],
                    aiSummary: null
                };
            }
        }
    }

    return null;
}

/**
 * SINGLE AI CALL
 * mood + category + tags
 */
async function analyzePostAI(
    caption,
    tags,
    availableCategories
) {
    try {
        const { generateText } = require('../utils/gemini');
        const prompt = `Analyze this social media post and return ONLY a raw JSON object with keys: "mood", "category", "tags", "aiSummary".

Caption: ${caption}
Tags: ${tags.join(', ')}

Available Categories (try to match one of these if possible, otherwise suggest a new one):
${availableCategories.slice(0, 40).join(', ')}

Your response MUST be ONLY valid JSON matching this schema:
{
  "mood": "happy|sad|excited|angry|calm|romantic|funny|inspirational|nostalgic|neutral",
  "category": "category name",
  "tags": ["tag1", "tag2"],
  "aiSummary": "1-2 sentence preview summary of the post caption."
}
Do not write anything else.`;

        const responseText = await generateText(prompt, { maxTokens: 512, temperature: 0.1 });
        const result = cleanAndParseJson(responseText);

        if (!result) {
            return {
                mood: 'Neutral',
                category: 'Default',
                tags,
                aiSummary: null
            };
        }

        let mood =
            result.mood || 'Neutral';

        mood =
            mood.charAt(0).toUpperCase() +
            mood.slice(1).toLowerCase();

        let category =
            result.category || 'Default';

        category = category
            .replace(/[^\w]/g, '')
            .trim();

        category =
            category.charAt(0).toUpperCase() +
            category.slice(1).toLowerCase();

        const aiTags = Array.isArray(result.tags)
            ? result.tags
                .map(t =>
                    t
                        .toLowerCase()
                        .replace(/[^\w]/g, '')
                )
                .filter(Boolean)
            : [];

        return {
            mood,
            category,
            tags: [...new Set([...tags, ...aiTags])],
            aiSummary: result.aiSummary || null
        };
    } catch (err) {
        console.warn(
            '⚠️ AI failed:',
            err?.message
        );

        return {
            mood: 'Neutral',
            category: 'Default',
            tags,
            aiSummary: null
        };
    }
}

async function uploadToCloudinary(
    base64Data,
    mimeType,
    folder
) {
    try {
        const resourceType =
            mimeType.startsWith('video/')
                ? 'video'
                : 'image';

        const response = await axios.post(
            CLOUDINARY_URL,
            {
                file: `data:${mimeType};base64,${base64Data}`,
                resourceType,
                folder
            },
            {
                timeout: 600000,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            }
        );

        return (
            response?.data?.data?.secure_url || null
        );
    } catch (err) {
        console.warn(
            '⚠️ Cloudinary upload failed:',
            err.message
        );

        return null;
    }
}

async function processPost({
    postMeta,
    postsDir,
    user,
    availableCategoriesSet,
    newCategoriesSet,
    uploadLimit,
    postDate
}) {
    try {
        const shortcode = postMeta.shortcode;
        const caption = postMeta.caption || '';
        const isVideo = postMeta.is_video;

        console.log(`🔍 ${shortcode}`);

        const cleanCaption = caption.length > 500 ? caption.slice(0, 497) + '...' : caption;

        // Check if post already exists by caption and user
        const existing = await Post.findOne({
            'user._id': user._id,
            caption: cleanCaption
        });

        if (existing) {
            console.log(`⏭️ Post already exists (by caption): ${shortcode}`);
            if (!existing.aiSummary && cleanCaption.length > 10) {
                console.log(`📝 Backfilling AI Summary for existing post: ${shortcode}`);
                const tags = [];
                const hashtagRegex = /#(\w+)/g;
                let match;
                while ((match = hashtagRegex.exec(cleanCaption)) !== null) {
                    tags.push(match[1].toLowerCase());
                }
                const aiResult = await analyzePostAI(cleanCaption, tags, [...availableCategoriesSet]);
                if (aiResult && aiResult.aiSummary) {
                    existing.aiSummary = aiResult.aiSummary;
                    await existing.save();
                    console.log(`✅ Backfilled AI Summary: "${aiResult.aiSummary}"`);
                }
            }
            return null;
        }

        /**
         * Find media files
         */
        let files = await fs.readdir(postsDir);

        files = files
            .filter(f => f.startsWith(shortcode))
            .sort((a, b) =>
                a.localeCompare(b, undefined, {
                    numeric: true
                })
            );

        if (!files.length) {
            console.warn(
                `⚠️ No media files for ${shortcode}`
            );

            return null;
        }

        /**
         * Upload media in parallel
         */
        const uploadResults = await Promise.all(
            files.map(file =>
                uploadLimit(async () => {
                    const filePath = path.join(
                        postsDir,
                        file
                    );

                    const buffer =
                        await fs.readFile(filePath);

                    const base64 =
                        buffer.toString('base64');

                    if (file.endsWith('.mp4')) {
                        const url =
                            await uploadToCloudinary(
                                base64,
                                'video/mp4',
                                `SocialSquare/${user._id}-${user.username}/posts`
                            );

                        return {
                            type: 'video',
                            url
                        };
                    }

                    if (file.endsWith('.jpg')) {
                        const url =
                            await uploadToCloudinary(
                                base64,
                                'image/jpeg',
                                `SocialSquare/${user._id}-${user.username}/posts`
                            );

                        return {
                            type: 'image',
                            url
                        };
                    }

                    return null;
                })
            )
        );

        const image_urls = uploadResults
            .filter(
                r =>
                    r &&
                    r.type === 'image' &&
                    r.url
            )
            .map(r => r.url);

        const video = uploadResults.find(
            r => r?.type === 'video'
        )?.url;

        if (!video && image_urls.length === 0) {
            console.warn(
                `⚠️ Upload failed for ${shortcode}`
            );

            return null;
        }

        /**
         * Content filtering
         */
        const violation =
            await checkContent(caption);

        if (
            violation &&
            violation.action === 'block'
        ) {
            console.warn(
                `⚠️ Blocked ${shortcode}`
            );

            return null;
        }

        /**
         * Extract hashtags
         */
        const tags = [];

        const hashtagRegex = /#(\w+)/g;

        let match;

        while (
            (match = hashtagRegex.exec(caption)) !==
            null
        ) {
            tags.push(
                match[1].toLowerCase()
            );
        }

        /**
         * LOCAL FAST PATH
         */
        let aiResult =
            localClassify(caption, tags);

        /**
         * AI fallback
         */
        if (!aiResult) {
            aiResult = await analyzePostAI(
                caption || 'Interesting moment',
                tags,
                [...availableCategoriesSet]
            );
        }

        /**
         * Dynamic categories
         */
        let finalCategory =
            aiResult.category || 'Default';

        const lower =
            finalCategory.toLowerCase();

        const matched = [
            ...availableCategoriesSet
        ].find(
            c => c.toLowerCase() === lower
        );

        if (matched) {
            finalCategory = matched;
        } else {
            availableCategoriesSet.add(
                finalCategory
            );

            newCategoriesSet.add(
                finalCategory
            );
        }

        /**
         * Create Post object
         */
        return {
            caption:
                caption.length > 500
                    ? caption.slice(0, 497) +
                    '...'
                    : caption,

            category: finalCategory,

            tags: aiResult.tags,

            mood: aiResult.mood,

            image_urls,

            video: isVideo
                ? video
                : null,

            videoThumbnail:
                isVideo && image_urls.length
                    ? image_urls[0]
                    : null,

            user: {
                _id: user._id,
                fullname: user.fullname,
                profile_picture:
                    user.profile_picture
            },

            isFlagged:
                violation?.action === 'flag',

            flagReason:
                violation?.action === 'flag'
                    ? violation.word
                    : null,

            createdAt: postDate,
            aiSummary: aiResult.aiSummary || null
        };
    } catch (err) {
        console.error(
            '❌ Post processing failed:',
            err.message
        );

        return null;
    }
}

async function run() {
    const args = process.argv.slice(2);
    const folderArg = args.find(a => !a.startsWith('--'));
    const startDateArg = args.find(a => a.startsWith('--start-date='))?.split('=')[1];
    const spaceDays = Number(args.find(a => a.startsWith('--space-days='))?.split('=')[1] || 1);

    if (!folderArg) {
        console.error(
            'Usage: node upload_local_insta_posts.js <folder> [--start-date=YYYY-MM-DD|now] [--space-days=N]'
        );

        process.exit(1);
    }

    const postsDir =
        path.resolve(folderArg);

    const metaPath = path.join(
        postsDir,
        'metadata.json'
    );

    try {
        await mongoose.connect(
            process.env.MONGO_URI
        );

        console.log(
            '✅ MongoDB Connected'
        );

        /**
         * Load metadata
         */
        const metaData = JSON.parse(
            await fs.readFile(
                metaPath,
                'utf8'
            )
        );

        /**
         * Categories
         */
        const dbCategories =
            await Category.find()
                .select('category')
                .lean();

        const availableCategoriesSet =
            new Set(
                dbCategories.map(
                    c => c.category
                )
            );

        const newCategoriesSet =
            new Set();

        /**
         * Verify Ollama
         */
        try {
            const models =
                await axios.get(
                    'http://localhost:11434/api/tags'
                );

            console.log(
                `✅ Ollama model: ${OLLAMA_MODEL}`
            );

            console.log(
                `📊 Available Models: ${models.data.models
                    ?.map(m => m.name)
                    .join(', ') || 'None'
                }`
            );
        } catch {
            console.warn(
                '⚠️ Ollama unavailable'
            );
        }

        /**
         * User
         */
        let user =
            await User.findOne({
                username:
                    metaData.target_username
            });

        if (!user) {
            user = await User.create({
                fullname:
                    metaData.full_name ||
                    metaData.target_username,

                username:
                    metaData.target_username,

                email: `${metaData.target_username}@gmail.com`,

                password:
                    'InstaUserPassword123!',

                authProvider: 'local',

                isEmailVerified: true,

                profile_picture:
                    'https://img.icons8.com/fluency/96/instagram-new.png'
            });

            console.log(
                `✅ User created ${user.username}`
            );
        }

        /**
 * PROFILE PICTURE UPLOAD + SYNC
 */
        const profilePicPath = path.join(
            postsDir,
            'profile_pic.jpg'
        );

        try {
            await fs.access(profilePicPath);

            console.log(
                `📸 Uploading profile picture for ${user.username}`
            );

            const profileBuffer =
                await fs.readFile(profilePicPath);

            const profileBase64 =
                profileBuffer.toString('base64');

            const profileUrl =
                await uploadToCloudinary(
                    profileBase64,
                    'image/jpeg',
                    `SocialSquare/${user._id}-${user.username}/profile`
                );

            if (profileUrl) {
                /**
                 * Update user profile picture
                 */
                user.profile_picture = profileUrl;

                await user.save();

                console.log(
                    `✅ Profile picture updated`
                );

                /**
                 * Sync old posts profile picture
                 */
                const syncResult =
                    await Post.updateMany(
                        {
                            'user._id': user._id
                        },
                        {
                            $set: {
                                'user.profile_picture':
                                    profileUrl
                            }
                        }
                    );

                console.log(
                    `🔄 Synced ${syncResult.modifiedCount} old posts`
                );
            }
        } catch {
            console.log(
                'ℹ️ No profile_pic.jpg found'
            );
        }
        /**
         * Concurrency controls
         */
        const limit =
            pLimit(CONCURRENCY);

        const uploadLimit =
            pLimit(UPLOAD_CONCURRENCY);

        /**
         * Process posts
         */
        let baseDate = null;
        if (startDateArg) {
            baseDate = startDateArg === 'now' ? new Date() : new Date(startDateArg);
        }

        const postResults =
            await Promise.all(
                metaData.posts.map(
                    (postMeta, idx) => {
                        let postDate;
                        if (baseDate) {
                            postDate = new Date(baseDate.getTime() + idx * spaceDays * 24 * 60 * 60 * 1000);
                        } else {
                            postDate = new Date(postMeta.date_utc || Date.now());
                        }

                        return limit(() =>
                            processPost({
                                postMeta,
                                postsDir,
                                user,
                                availableCategoriesSet,
                                newCategoriesSet,
                                uploadLimit,
                                postDate
                            })
                        );
                    }
                )
            );

        const validPosts =
            postResults.filter(Boolean);

        console.log(
            `📊 Valid posts: ${validPosts.length}`
        );

        /**
         * Bulk insert posts
         */
        if (validPosts.length) {
            const insertedPosts =
                await Post.insertMany(
                    validPosts,
                    {
                        ordered: false
                    }
                );

            console.log(
                `✅ Inserted ${insertedPosts.length} posts`
            );

            /**
             * Update user count ONCE
             */
            await User.findByIdAndUpdate(
                user._id,
                {
                    $inc: {
                        postsCount:
                            insertedPosts.length
                    }
                }
            );

            /**
             * Parallel gamification
             */
            await Promise.allSettled(
                insertedPosts.map(post =>
                    updateGamification(
                        user._id,
                        'post'
                    )
                )
            );
        }

        /**
         * Bulk create categories
         */
        if (
            newCategoriesSet.size > 0
        ) {
            await Category.insertMany(
                [...newCategoriesSet].map(
                    category => ({
                        category
                    })
                ),
                {
                    ordered: false
                }
            );

            console.log(
                `✨ Added ${newCategoriesSet.size} new categories`
            );
        }

        console.log(
            '\n==================================='
        );

        console.log(
            '✅ IMPORT COMPLETED'
        );

        console.log(
            `📊 Posts Imported: ${validPosts.length}`
        );

        console.log(
            `✨ New Categories: ${newCategoriesSet.size}`
        );

        console.log(
            '==================================='
        );

        await mongoose.disconnect();
    } catch (err) {
        console.error(
            '🔥 Fatal Error:',
            err
        );

        await mongoose.disconnect();
    }
}

run();