import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

class CacheService {
    /**
     * Cache data to native storage
     * @param {string} key Unique key for the cache
     * @param {any} data Data to be cached (will be stringified)
     * @param {number} ttl Time to live in milliseconds
     */
    async set(key, data, ttl = DEFAULT_TTL) {
        if (!Capacitor.isNativePlatform()) return;

        try {
            const fileName = `cache_${key}.json`;
            const serializedData = JSON.stringify(data);

            // Save data to Filesystem (Cache directory is cleared by OS when needed)
            await Filesystem.writeFile({
                path: fileName,
                data: serializedData,
                directory: Directory.Cache,
                encoding: Encoding.UTF8,
            });

            // Save metadata to Preferences for TTL check
            await Preferences.set({
                key: `cache_meta_${key}`,
                value: JSON.stringify({
                    timestamp: Date.now(),
                    ttl,
                    fileName,
                }),
            });
        } catch (err) {
            console.error(`[CacheService] Set error for ${key}:`, err);
        }
    }

    /**
     * Retrieve cached data
     * @param {string} key Unique key for the cache
     * @returns {Promise<any | null>} Cached data or null if not found/expired
     */
    async get(key) {
        if (!Capacitor.isNativePlatform()) return null;

        try {
            const { value: metaValue } = await Preferences.get({ key: `cache_meta_${key}` });
            if (!metaValue) return null;

            const meta = JSON.parse(metaValue);
            
            // TTL check
            if (Date.now() - meta.timestamp > meta.ttl) {
                console.log(`[CacheService] Cache expired for ${key}`);
                this.remove(key);
                return null;
            }

            const { data } = await Filesystem.readFile({
                path: meta.fileName,
                directory: Directory.Cache,
                encoding: Encoding.UTF8,
            });

            return JSON.parse(data);
        } catch (err) {
            // Handle file not found or other errors silently
            return null;
        }
    }

    /**
     * Remove specific cache
     * @param {string} key 
     */
    async remove(key) {
        if (!Capacitor.isNativePlatform()) return;

        try {
            const { value: metaValue } = await Preferences.get({ key: `cache_meta_${key}` });
            if (metaValue) {
                const meta = JSON.parse(metaValue);
                try {
                    await Filesystem.deleteFile({
                        path: meta.fileName,
                        directory: Directory.Cache,
                    });
                } catch (e) {}
            }
            await Preferences.remove({ key: `cache_meta_${key}` });
        } catch (err) {
            console.error(`[CacheService] Remove error for ${key}:`, err);
        }
    }
}

export const cacheService = new CacheService();
export default cacheService;
