/**
 * Ultra Optimized Recategorize All Posts Script (Ollama Edition)
 *
 * Improvements:
 * ✅ Parallel processing with concurrency control
 * ✅ Bulk MongoDB updates
 * ✅ Streaming cursor (low memory)
 * ✅ Removed artificial delay
 * ✅ Faster prompt
 * ✅ Keyword-based fast classification
 * ✅ Dynamic category registration
 * ✅ Better error handling
 * ✅ Reduced DB writes
 * ✅ Optimized Ollama usage
 *
 * Usage:
 *   npm install p-limit
 *
 * Run:
 *   node scripts/recategorize_all_posts.js
 *   node scripts/recategorize_all_posts.js --all
 */

const path = require('path');
require('dotenv').config({
    path: path.join(__dirname, '../.env')
});

const mongoose = require('mongoose');
const axios = require('axios');
const pLimit = require('p-limit');

const Post = require('../models/Post');
const Category = require('../models/Category');
const { PostVector } = require('../models/Recommendation');

const MONGO_URI = process.env.MONGO_URI;

const OLLAMA_URL = 'http://localhost:11434/api/generate';

/**
 * Faster models:
 * mistral
 * qwen2.5:3b
 * qwen2.5:3b
 * gemma:2b
 */
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';

const CONCURRENCY = Number(process.env.CLASSIFY_CONCURRENCY || 2);

const BATCH_SIZE = 100;

if (!MONGO_URI) {
    console.error('❌ MONGO_URI missing in .env');
    process.exit(1);
}

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
    } catch (err) {
        return null;
    }
}

/**
 * VERY FAST LOCAL KEYWORD CLASSIFIER
 * Avoids unnecessary AI calls
 */
function classifyWithKeywords(caption = '', tags = []) {
    const text = `${caption} ${tags.join(' ')}`.toLowerCase();

    const keywordMap = {
        Food: ['food', 'burger', 'pizza', 'recipe', 'cooking', 'restaurant'],
        Fitness: ['gym', 'workout', 'fitness', 'bodybuilding', 'exercise'],
        Travel: ['travel', 'trip', 'vacation', 'beach', 'mountain'],
        Gaming: ['game', 'gaming', 'pubg', 'valorant', 'minecraft'],
        Coding: ['code', 'coding', 'javascript', 'react', 'nodejs'],
        Tech: ['ai', 'technology', 'laptop', 'computer', 'software'],
        Fashion: ['fashion', 'outfit', 'style', 'clothing'],
        Beauty: ['makeup', 'beauty', 'skincare'],
        Pets: ['dog', 'cat', 'pet', 'puppy'],
        Business: ['startup', 'business', 'money', 'finance'],
        Comedy: ['meme', 'funny', 'joke', 'comedy']
    };

    for (const [category, keywords] of Object.entries(keywordMap)) {
        for (const keyword of keywords) {
            if (text.includes(keyword)) {
                return {
                    category,
                    tags: [...new Set([...tags, keyword])]
                };
            }
        }
    }

    return null;
}

async function classifyWithOllama(caption, tags, availableCategories) {
    try {
        const prompt = `
Caption: ${caption || 'No caption'}

Tags: ${tags.join(', ')}

Available Categories:
${availableCategories.slice(0, 50).join(', ')}

Return ONLY valid raw JSON:

{
  "category": "CategoryName",
  "tags": ["tag1", "tag2", "tag3"]
}
`;

        const response = await axios.post(
            OLLAMA_URL,
            {
                model: OLLAMA_MODEL,
                prompt,
                stream: false
            },
            {
                timeout: 60000
            }
        );

        const resultObj = cleanAndParseJson(response.data.response);

        if (!resultObj || !resultObj.category) {
            return null;
        }

        let category = resultObj.category
            .trim()
            .replace(/[^\w]/g, '');

        if (!category) return null;

        category =
            category.charAt(0).toUpperCase() +
            category.slice(1).toLowerCase();

        const aiTags = Array.isArray(resultObj.tags)
            ? resultObj.tags
                .map(t =>
                    t
                        .trim()
                        .toLowerCase()
                        .replace(/[^\w]/g, '')
                )
                .filter(Boolean)
            : [];

        const finalTags = [...new Set([...tags, ...aiTags])];

        return {
            category,
            tags: finalTags
        };
    } catch (err) {
        console.warn(`⚠️ Ollama failed: ${err.message}`);
        return null;
    }
}

async function processPost(post, availableCategoriesSet, newCategoriesSet) {
    try {
        const caption = post.caption || '';

        const hasExistingTags =
            Array.isArray(post.tags) && post.tags.length > 0;

        const isCategoryDefault =
            !post.category || post.category === 'Default';

        let tags = Array.isArray(post.tags)
            ? [...post.tags]
            : [];

        /**
         * Extract hashtags
         */
        if (!hasExistingTags && caption) {
            const hashtagRegex = /#(\w+)/g;

            let match;

            while ((match = hashtagRegex.exec(caption)) !== null) {
                tags.push(match[1].toLowerCase());
            }

            tags = [...new Set(tags)];
        }

        /**
         * Skip fully enriched posts
         */
        if (!isCategoryDefault && hasExistingTags) {
            return null;
        }

        /**
         * Try FAST local classification first
         */
        let classificationResult =
            classifyWithKeywords(caption, tags);

        /**
         * Fallback to Ollama
         */
        if (!classificationResult) {
            classificationResult = await classifyWithOllama(
                caption,
                tags,
                [...availableCategoriesSet]
            );
        }

        if (!classificationResult) {
            return null;
        }

        let newCategory = post.category;
        let enrichedTags = tags;

        /**
         * Update category only if default
         */
        if (
            isCategoryDefault &&
            classificationResult.category &&
            classificationResult.category !== 'Default'
        ) {
            newCategory = classificationResult.category;

            const lowerCategory = newCategory.toLowerCase();

            const matchedCategory = [...availableCategoriesSet].find(
                c => c.toLowerCase() === lowerCategory
            );

            if (matchedCategory) {
                newCategory = matchedCategory;
            } else {
                availableCategoriesSet.add(newCategory);
                newCategoriesSet.add(newCategory);
            }
        }

        /**
         * Update tags only if empty
         */
        if (
            !hasExistingTags &&
            classificationResult.tags?.length
        ) {
            enrichedTags = classificationResult.tags;
        }

        const categoryChanged =
            newCategory !== post.category;

        const tagsChanged =
            JSON.stringify(enrichedTags) !==
            JSON.stringify(post.tags || []);

        if (!categoryChanged && !tagsChanged) {
            return null;
        }

        return {
            postId: post._id,
            category: newCategory,
            tags: enrichedTags,
            oldCategory: post.category
        };
    } catch (err) {
        console.error(
            `❌ Failed processing post ${post._id}:`,
            err.message
        );

        return null;
    }
}

async function run() {
    console.log('📦 Connecting to MongoDB...');

    await mongoose.connect(MONGO_URI);

    console.log('✅ Connected to MongoDB');

    /**
     * Check Ollama
     */
    try {
        await axios.get(
            'http://localhost:11434/api/tags',
            {
                timeout: 3000
            }
        );

        console.log(
            `✅ Ollama connected using "${OLLAMA_MODEL}"`
        );
    } catch (err) {
        console.error(
            '❌ Ollama server not running on localhost:11434'
        );

        process.exit(1);
    }

    const processAll = process.argv.includes('--all');

    /**
     * Load categories
     */
    const dbCategories = await Category.find()
        .select('category')
        .lean();

    const availableCategoriesSet = new Set(
        dbCategories.map(c => c.category)
    );

    const newCategoriesSet = new Set();

    console.log(
        `📊 Loaded ${availableCategoriesSet.size} categories`
    );

    /**
     * Query
     */
    const query = processAll
        ? { deletedAt: null }
        : {
            deletedAt: null,
            category: 'Default'
        };

    console.log('🔍 Query:', query);

    /**
     * STREAMING CURSOR
     */
    const cursor = Post.find(query)
        .select('_id caption category tags')
        .lean()
        .cursor();

    const limit = pLimit(CONCURRENCY);

    let processed = 0;
    let updated = 0;
    let skipped = 0;

    let batch = [];

    const postBulkOps = [];
    const vectorBulkOps = [];

    console.log(
        `🚀 Starting optimized classification with concurrency ${CONCURRENCY}`
    );

    async function flushBulk() {
        if (!postBulkOps.length) return;

        try {
            await Post.bulkWrite(postBulkOps);

            await PostVector.bulkWrite(vectorBulkOps, {
                ordered: false
            });

            console.log(
                `✅ Bulk updated ${postBulkOps.length} posts`
            );

            postBulkOps.length = 0;
            vectorBulkOps.length = 0;
        } catch (err) {
            console.error(
                '❌ Bulk write failed:',
                err.message
            );
        }
    }

    for await (const post of cursor) {
        batch.push(
            limit(async () => {
                processed++;

                console.log(
                    `🔍 Processing ${processed}: ${post._id}`
                );

                const result = await processPost(
                    post,
                    availableCategoriesSet,
                    newCategoriesSet
                );

                if (!result) {
                    skipped++;
                    return;
                }

                updated++;

                postBulkOps.push({
                    updateOne: {
                        filter: {
                            _id: result.postId
                        },
                        update: {
                            $set: {
                                category: result.category,
                                tags: result.tags
                            }
                        }
                    }
                });

                vectorBulkOps.push({
                    updateOne: {
                        filter: {
                            postId: result.postId
                        },
                        update: {
                            $set: {
                                category: result.category,
                                tags: result.tags
                            }
                        },
                        upsert: false
                    }
                });

                console.log(
                    `✅ ${result.postId} | ${result.oldCategory} ➜ ${result.category}`
                );

                /**
                 * Flush batch
                 */
                if (postBulkOps.length >= BATCH_SIZE) {
                    await flushBulk();
                }
            })
        );

        /**
         * Prevent giant memory buildup
         */
        if (batch.length >= 500) {
            await Promise.all(batch);
            batch = [];
        }
    }

    /**
     * Final remaining tasks
     */
    if (batch.length) {
        await Promise.all(batch);
    }

    /**
     * Final DB flush
     */
    await flushBulk();

    /**
     * Save newly discovered categories
     */
    if (newCategoriesSet.size > 0) {
        const categoryDocs = [...newCategoriesSet].map(
            category => ({
                category
            })
        );

        try {
            await Category.insertMany(categoryDocs, {
                ordered: false
            });

            console.log(
                `✨ Added ${categoryDocs.length} new categories`
            );
        } catch (err) {
            console.warn(
                '⚠️ Some categories may already exist'
            );
        }
    }

    console.log('\n================================================');
    console.log('🏁 PIPELINE COMPLETED');
    console.log(`📊 Processed: ${processed}`);
    console.log(`✅ Updated: ${updated}`);
    console.log(`⏭️ Skipped: ${skipped}`);
    console.log(
        `✨ New Categories: ${newCategoriesSet.size}`
    );
    console.log('================================================');

    process.exit(0);
}

run().catch(err => {
    console.error('🔥 Fatal Error:', err);

    process.exit(1);
});