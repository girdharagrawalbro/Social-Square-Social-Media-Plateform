const path = require('path');
require('dotenv').config({
    path: path.join(__dirname, '../.env')
});

const mongoose = require('mongoose');
const pLimit = require('p-limit');

const Post = require('../models/Post');
const Category = require('../models/Category');
const { PostVector } = require('../models/Recommendation');
const { generateText } = require('../utils/gemini');

const MONGO_URI = process.env.MONGO_URI;
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

async function classifyWithAI(caption, tags, availableCategories) {
    try {
        const prompt = `Analyze this post.
Caption: ${caption || 'No caption'}
Tags: ${tags.join(', ')}

Available Categories:
${availableCategories.slice(0, 50).join(', ')}

Return ONLY valid raw JSON:
{
  "category": "CategoryName",
  "tags": ["tag1", "tag2", "tag3"]
}
Do not write anything else.`;

        const responseText = await generateText(prompt, { maxTokens: 256, temperature: 0.1 });
        const resultObj = cleanAndParseJson(responseText);

        if (!resultObj || !resultObj.category) {
            return null;
        }

        let category = resultObj.category.trim().replace(/[^\w]/g, '');
        if (!category) return null;

        category = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();

        const aiTags = Array.isArray(resultObj.tags)
            ? resultObj.tags
                .map(t => t.trim().toLowerCase().replace(/[^\w]/g, ''))
                .filter(Boolean)
            : [];

        const finalTags = [...new Set([...tags, ...aiTags])];

        return {
            category,
            tags: finalTags
        };
    } catch (err) {
        console.warn(`⚠️ AI failed: ${err.message}`);
        return null;
    }
}

async function processPost(post, availableCategoriesSet, newCategoriesSet) {
    try {
        const caption = post.caption || '';
        const hasExistingTags = Array.isArray(post.tags) && post.tags.length > 0;
        const isCategoryDefault = !post.category || post.category === 'Default';

        let tags = Array.isArray(post.tags) ? [...post.tags] : [];

        // Extract hashtags
        if (!hasExistingTags && caption) {
            const hashtagRegex = /#(\w+)/g;
            let match;
            while ((match = hashtagRegex.exec(caption)) !== null) {
                tags.push(match[1].toLowerCase());
            }
            tags = [...new Set(tags)];
        }

        // Check if both properties already exist
        if (!isCategoryDefault && hasExistingTags) {
            return null;
        }

        // Try fast local classification
        let classificationResult = classifyWithKeywords(caption, tags);

        // Fallback to AI
        if (!classificationResult) {
            classificationResult = await classifyWithAI(
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

        // Update category only if default
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

        // Update tags only if empty
        if (!hasExistingTags && classificationResult.tags?.length) {
            enrichedTags = classificationResult.tags;
        }

        const categoryChanged = newCategory !== post.category;
        const tagsChanged = JSON.stringify(enrichedTags) !== JSON.stringify(post.tags || []);

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
        console.error(`❌ Failed processing post ${post._id}:`, err.message);
        return null;
    }
}

async function run() {
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const processAll = process.argv.includes('--all');

    const dbCategories = await Category.find().select('category').lean();
    const availableCategoriesSet = new Set(dbCategories.map(c => c.category));
    const newCategoriesSet = new Set();

    console.log(`📊 Loaded ${availableCategoriesSet.size} categories`);

    const query = processAll ? { deletedAt: null } : { deletedAt: null, category: 'Default' };
    console.log('🔍 Query:', query);

    const cursor = Post.find(query).select('_id caption category tags').lean().cursor();
    const limit = pLimit(CONCURRENCY);

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let batch = [];

    const postBulkOps = [];
    const vectorBulkOps = [];

    console.log(`🚀 Starting optimized classification with concurrency ${CONCURRENCY}`);

    async function flushBulk() {
        if (!postBulkOps.length) return;

        try {
            await Post.bulkWrite(postBulkOps);
            console.log(`✅ Bulk updated ${postBulkOps.length} posts`);
            postBulkOps.length = 0;
            vectorBulkOps.length = 0;
        } catch (err) {
            console.error('❌ Bulk write failed:', err.message);
        }
    }

    let doc;
    while ((doc = await cursor.next())) {
        processed++;
        const postDoc = doc;

        batch.push(
            limit(async () => {
                const res = await processPost(postDoc, availableCategoriesSet, newCategoriesSet);
                if (res) {
                    updated++;
                    postBulkOps.push({
                        updateOne: {
                            filter: { _id: res.postId },
                            update: {
                                $set: {
                                    category: res.category,
                                    tags: res.tags
                                }
                            }
                        }
                    });
                } else {
                    skipped++;
                }
            })
        );

        if (batch.length >= BATCH_SIZE) {
            await Promise.all(batch);
            batch = [];
            await flushBulk();
            console.log(`Processed ${processed} documents...`);
        }
    }

    if (batch.length > 0) {
        await Promise.all(batch);
        await flushBulk();
    }

    // Bulk create new categories
    if (newCategoriesSet.size > 0) {
        try {
            await Category.insertMany(
                [...newCategoriesSet].map(c => ({ category: c })),
                { ordered: false }
            );
            console.log(`✨ Registered ${newCategoriesSet.size} new categories in database.`);
        } catch {}
    }

    console.log('\n======================================');
    console.log('✅ RECATEGORIZATION COMPLETED');
    console.log(`📊 Total Processed: ${processed}`);
    console.log(`✅ Total Updated:   ${updated}`);
    console.log(`⏭️ Total Skipped:   ${skipped}`);
    console.log('======================================');

    await mongoose.disconnect();
}

run().catch(err => {
    console.error('🔥 Fatal Error:', err);
    process.exit(1);
});