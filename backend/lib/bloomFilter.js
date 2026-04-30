const crypto = require('crypto');
const redis = require('./redis');

/**
 * A simple Redis-backed Bloom Filter implementation using standard SETBIT/GETBIT.
 * Space-efficient probabilistic data structure to check if an item is in a set.
 */
class RedisBloomFilter {
    /**
     * @param {string} key - Redis key namespace (e.g., 'bf:seen:1234')
     * @param {number} size - Number of bits (higher = less false positives, more memory). Default 100,000 ~12KB.
     * @param {number} hashes - Number of hash functions to run. Default 4.
     * @param {number} expireSeconds - Optional expiry in seconds (default 30 days) to clear stale filters.
     */
    constructor(key, size = 100000, hashes = 4, expireSeconds = 30 * 24 * 60 * 60) {
        this.key = key;
        this.size = size;
        this.hashes = hashes;
        this.expireSeconds = expireSeconds;
    }

    _getOffsets(item) {
        const offsets = [];
        const hash = crypto.createHash('md5').update(String(item)).digest('hex');
        
        // Use chunks of the MD5 hash as pseudo-independent hash functions
        for (let i = 0; i < this.hashes; i++) {
            const chunk = hash.substring(i * 8, (i + 1) * 8);
            const intVal = parseInt(chunk, 16);
            offsets.push(intVal % this.size);
        }
        return offsets;
    }

    /**
     * Add an item to the Bloom filter.
     * @param {string} item 
     */
    async add(item) {
        if (redis.status === 'disabled') return;
        
        const offsets = this._getOffsets(item);
        const pipeline = redis.pipeline();
        
        offsets.forEach(offset => {
            pipeline.setbit(this.key, offset, 1);
        });
        
        if (this.expireSeconds) {
            pipeline.expire(this.key, this.expireSeconds);
        }
        
        await pipeline.exec();
    }

    /**
     * Check if an item might be in the Bloom filter.
     * Returns true if it MIGHT be in the set (with small false positive rate).
     * Returns false if it is DEFINITELY NOT in the set.
     * @param {string} item 
     * @returns {Promise<boolean>}
     */
    async mightContain(item) {
        if (redis.status === 'disabled') return false; // Fail-open gracefully
        
        const offsets = this._getOffsets(item);
        const pipeline = redis.pipeline();
        
        offsets.forEach(offset => {
            pipeline.getbit(this.key, offset);
        });
        
        const results = await pipeline.exec();
        // pipeline.exec() returns array of [error, result]
        return results.every(res => res[1] === 1);
    }

    /**
     * Batch check multiple items efficiently via a single pipeline.
     * @param {string[]} items 
     * @returns {Promise<boolean[]>} Array of booleans corresponding to each item
     */
    async mightContainMultiple(items) {
        if (!items || items.length === 0) return [];
        if (redis.status === 'disabled') return items.map(() => false);

        const pipeline = redis.pipeline();
        items.forEach(item => {
            const offsets = this._getOffsets(item);
            offsets.forEach(offset => pipeline.getbit(this.key, offset));
        });

        const results = await pipeline.exec();
        
        const answers = [];
        let resultIdx = 0;
        
        for (let i = 0; i < items.length; i++) {
            let contains = true;
            for (let h = 0; h < this.hashes; h++) {
                if (results[resultIdx][1] === 0) {
                    contains = false;
                }
                resultIdx++;
            }
            answers.push(contains);
        }
        
        return answers;
    }
}

module.exports = RedisBloomFilter;
