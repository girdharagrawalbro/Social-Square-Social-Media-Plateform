/**
 * tagGraph.js — Tag Co-occurrence Graph (P10)
 *
 * Maintains a Redis-backed graph of which tags appear together.
 * When a user likes/saves a post, we increment co-occurrence scores
 * between all pairs of tags on that post.
 *
 * This allows the explore feed to expand from "react" → ["typescript", "hooks", "nextjs"]
 * based on what the broader community has seen together — without needing a separate ML model.
 *
 * Storage: Redis Sorted Sets
 *   key:   tag:cooc:<tagName>
 *   member: <relatedTag>
 *   score:  co-occurrence count (higher = appears together more often)
 */

const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days; refresh on write

/**
 * Increment co-occurrence scores between all pairs of tags in the provided list.
 * Safe to call fire-and-forget — errors are caught and logged.
 *
 * @param {string[]} tags - Array of tag strings from a post
 * @param {object} redis  - ioredis client
 */
async function updateTagCooccurrence(tags, redis) {
    if (!redis || !Array.isArray(tags) || tags.length < 2) return;

    try {
        const pipeline = redis.pipeline();

        for (let i = 0; i < tags.length; i++) {
            for (let j = i + 1; j < tags.length; j++) {
                const tagA = tags[i].toLowerCase().trim();
                const tagB = tags[j].toLowerCase().trim();
                if (!tagA || !tagB || tagA === tagB) continue;

                pipeline.zincrby(`tag:cooc:${tagA}`, 1, tagB);
                pipeline.zincrby(`tag:cooc:${tagB}`, 1, tagA);
                // Reset TTL on each write so hot tags persist longer
                pipeline.expire(`tag:cooc:${tagA}`, TTL_SECONDS);
                pipeline.expire(`tag:cooc:${tagB}`, TTL_SECONDS);
            }
        }

        await pipeline.exec();
    } catch (err) {
        // Non-critical; don't crash the caller
        console.warn('[tagGraph] updateTagCooccurrence error:', err.message);
    }
}

/**
 * Expand a list of liked tags to include closely related tags.
 * Queries the co-occurrence sorted sets and returns the union of:
 *   - the original liked tags
 *   - the top-N related tags for each source tag
 *
 * @param {string[]} likedTags  - Tags the user is known to like
 * @param {object}   redis      - ioredis client
 * @param {number}   perTag     - How many related tags to pull per source tag (default 3)
 * @param {number}   totalLimit - Maximum tags to return in total (default 15)
 * @returns {Promise<string[]>} - Expanded tag list (unique, lowercase)
 */
async function expandTagsFromGraph(likedTags, redis, perTag = 3, totalLimit = 15) {
    if (!redis || !Array.isArray(likedTags) || likedTags.length === 0) return likedTags;

    const expanded = new Set(likedTags.map(t => t.toLowerCase().trim()).filter(Boolean));

    try {
        const pipeline = redis.pipeline();
        const sourceTags = [...expanded].slice(0, 5); // Only expand from top 5 to avoid over-broadening

        for (const tag of sourceTags) {
            pipeline.zrevrange(`tag:cooc:${tag}`, 0, perTag - 1); // Top N related tags by score
        }

        const results = await pipeline.exec();
        if (!results) return [...expanded].slice(0, totalLimit);

        for (const [err, related] of results) {
            if (err || !Array.isArray(related)) continue;
            for (const relTag of related) {
                expanded.add(relTag.toLowerCase().trim());
                if (expanded.size >= totalLimit) break;
            }
            if (expanded.size >= totalLimit) break;
        }
    } catch (err) {
        console.warn('[tagGraph] expandTagsFromGraph error:', err.message);
    }

    return [...expanded].slice(0, totalLimit);
}

module.exports = { updateTagCooccurrence, expandTagsFromGraph };
