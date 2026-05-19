/**
 * ULTRA OPTIMIZED VECTORIZE ALL POSTS
 *
 * Improvements:
 * ✅ Parallel vector generation
 * ✅ Bulk MongoDB writes
 * ✅ Streaming cursor
 * ✅ Concurrency control
 * ✅ Memory optimized
 * ✅ Faster orphan cleanup
 * ✅ Reduced DB queries
 * ✅ Exponential retry with jitter
 * ✅ Batched processing
 * ✅ Removed artificial 1.5s delay
 * ✅ Better Gemini rate-limit handling
 * ✅ Production scalable
 *
 * INSTALL:
 * npm i p-limit
 *
 * RUN:
 * node scripts/vectorize_all_posts.js
 */

const path = require('path');

require('dotenv').config({
    path: path.join(__dirname, '../.env')
});

const mongoose = require('mongoose');
const axios = require('axios');
const pLimit = require('p-limit');

const Post = require('../models/Post');

const {
    PostVector
} = require('../models/Recommendation');

const MONGO_URI =
    process.env.MONGO_URI;

const OLLAMA_URL = 'http://localhost:11434/api/embeddings';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';

if (!MONGO_URI) {
    console.error(
        '❌ MONGO_URI missing'
    );

    process.exit(1);
}

/**
 * TUNE THESE
 */
const CONCURRENCY =
    Number(
        process.env.VECTOR_CONCURRENCY || 3
    );

const BATCH_SIZE = 100;

const MAX_RETRIES = 5;

const INITIAL_DELAY = 2000;

/**
 * Retry helper
 */
function sleep(ms) {
    return new Promise(resolve =>
        setTimeout(resolve, ms)
    );
}

/**
 * Embedding Generator
 * with exponential retry
 */
async function getEmbedding(
    text,
    retries = MAX_RETRIES
) {
    let delay = INITIAL_DELAY;

    for (
        let attempt = 1;
        attempt <= retries;
        attempt++
    ) {
        try {
            const response = await axios.post(
                OLLAMA_URL,
                {
                    model: OLLAMA_MODEL,
                    prompt: text
                },
                {
                    timeout: 30000
                }
            );

            if (response.data && response.data.embedding) {
                return response.data.embedding;
            }

            throw new Error('Invalid response structure from Ollama embeddings');
        } catch (err) {
            const isLast =
                attempt === retries;

            const jitter =
                Math.floor(
                    Math.random() * 1000
                );

            console.warn(
                `⚠️ Embedding retry ${attempt}/${retries}:`,
                err.message
            );

            if (isLast) {
                throw err;
            }

            await sleep(delay + jitter);

            delay *= 2;
        }
    }
}

/**
 * Process ONE post
 */
async function processPost(post) {
    try {
        const embeddingText = `
${post.caption || ''}
${post.category || 'Default'}
${(post.tags || []).join(' ')}
`
            .trim()
            .slice(0, 3000);

        const finalText =
            embeddingText ||
            'Social Square Post';

        const vector =
            await getEmbedding(finalText);

        return {
            updateOne: {
                filter: {
                    postId: post._id
                },

                update: {
                    $set: {
                        vector,

                        category:
                            post.category ||
                            'Default',

                        tags:
                            post.tags || [],

                        createdAt:
                            post.createdAt ||
                            new Date()
                    }
                },

                upsert: true
            }
        };
    } catch (err) {
        console.error(
            `❌ Failed ${post._id}:`,
            err.message
        );

        return null;
    }
}

async function run() {
    console.log(
        '📦 Connecting MongoDB...'
    );

    await mongoose.connect(
        MONGO_URI
    );

    console.log(
        '✅ MongoDB Connected'
    );

    /**
     * Verify Ollama
     */
    console.log(
        '🔍 Verifying Ollama connection...'
    );

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

    /**
     * Load existing vectors
     */
    console.log(
        '🔍 Fetching existing vectors...'
    );

    const existingVectors =
        await PostVector.find({})
            .select('postId')
            .lean();

    const existingVectorIds =
        new Set(
            existingVectors.map(v =>
                v.postId.toString()
            )
        );

    console.log(
        `📊 Existing vectors: ${existingVectorIds.size}`
    );

    /**
     * Stream posts
     */
    console.log(
        '🔍 Streaming active posts...'
    );

    const cursor = Post.find({
        deletedAt: null
    })
        .select(
            '_id caption category tags createdAt'
        )
        .lean()
        .cursor();

    /**
     * Cleanup orphan vectors
     */
    console.log(
        '🧹 Checking orphan vectors...'
    );

    const activeIds = new Set();

    /**
     * Concurrency control
     */
    const limit =
        pLimit(CONCURRENCY);

    let processed = 0;

    let skipped = 0;

    let success = 0;

    let failed = 0;

    let batch = [];

    let bulkOps = [];

    async function flushBulk() {
        if (!bulkOps.length) return;

        try {
            await PostVector.bulkWrite(
                bulkOps,
                {
                    ordered: false
                }
            );

            console.log(
                `✅ Bulk inserted ${bulkOps.length} vectors`
            );

            success += bulkOps.length;

            bulkOps = [];
        } catch (err) {
            console.error(
                '❌ Bulk write failed:',
                err.message
            );
        }
    }

    for await (const post of cursor) {
        activeIds.add(
            post._id.toString()
        );

        /**
         * Skip already vectorized
         */
        if (
            existingVectorIds.has(
                post._id.toString()
            )
        ) {
            skipped++;

            continue;
        }

        batch.push(
            limit(async () => {
                processed++;

                console.log(
                    `🔍 [${processed}] ${post._id}`
                );

                const op =
                    await processPost(post);

                if (!op) {
                    failed++;

                    return;
                }

                bulkOps.push(op);

                /**
                 * Flush batch
                 */
                if (
                    bulkOps.length >=
                    BATCH_SIZE
                ) {
                    await flushBulk();
                }
            })
        );

        /**
         * Prevent memory explosion
         */
        if (batch.length >= 300) {
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
     * Final flush
     */
    await flushBulk();

    /**
     * Cleanup orphan vectors
     */
    const orphanIds =
        existingVectors
            .filter(
                v =>
                    v.postId &&
                    !activeIds.has(
                        v.postId.toString()
                    )
            )
            .map(v => v.postId);

    if (orphanIds.length > 0) {
        console.log(
            `🧹 Removing ${orphanIds.length} orphan vectors`
        );

        const cleanup =
            await PostVector.deleteMany({
                postId: {
                    $in: orphanIds
                }
            });

        console.log(
            `✅ Removed ${cleanup.deletedCount} orphan vectors`
        );
    }

    console.log(
        '\n===================================='
    );

    console.log(
        '🏁 VECTORIZATION COMPLETED'
    );

    console.log(
        `📊 Processed: ${processed}`
    );

    console.log(
        `✅ Success: ${success}`
    );

    console.log(
        `⏭️ Skipped: ${skipped}`
    );

    console.log(
        `❌ Failed: ${failed}`
    );

    console.log(
        '===================================='
    );

    process.exit(0);
}

run().catch(async err => {
    console.error(
        '🔥 Fatal Error:',
        err
    );

    await mongoose.disconnect();

    process.exit(1);
});