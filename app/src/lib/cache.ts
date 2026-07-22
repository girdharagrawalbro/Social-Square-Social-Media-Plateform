import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'ss_cache:';

export const TTL = {
  FEED: 5 * 60 * 1000,   // 5 min  — home feed posts
  STORIES: 3 * 60 * 1000,   // 3 min  — stories strip
  NOTIFICATIONS: 2 * 60 * 1000,   // 2 min  — notification list
  CONVERSATIONS: 2 * 60 * 1000,   // 2 min  — chat list
  MESSAGES: 10 * 60 * 1000,   // 10 min  — chat messages
  PROFILE: 30 * 60 * 1000,   // 30 min — user profile data
  EXPLORE: 10 * 60 * 1000,   // 10 min — explore/reels grid
  USER_INFO: 30 * 60 * 1000,   // 30 min — other user info
  FORM_DATA: 15 * 60 * 1000,   // 15 min — groups, goals, users list
  ONLINE_STATUS: 20 * 1000,        // 20 sec — online/lastseen
  FOLLOWS_LIST: 5 * 60 * 1000,     // 5 min  — followers/following lists
  CLOSE_FRIENDS: 10 * 60 * 1000,   // 10 min — close friends list
  ACTIVE_SESSIONS: 2 * 60 * 1000,  // 2 min  — active sessions
  OWN_PROFILE_POSTS: 30 * 60 * 1000 // 30 min  — current user's profile posts
} as const;

interface CacheEntry<T> {
  data: T;
  ts: number;   // Date.now() at write time
  ttl: number;  // ms
}

/** Read a cached value. Returns null if missing or expired. */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.ts > entry.ttl) {
      await AsyncStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

/** Write a value to cache with a TTL. */
export async function setCache<T>(key: string, data: T, ttlMs: number = TTL.FEED): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, ts: Date.now(), ttl: ttlMs };
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // cache write failures are non-fatal
  }
}

/** Remove a single cache key. */
export async function invalidateCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_PREFIX + key);
  } catch { }
}

/** Remove all cache keys whose name starts with prefix. */
export async function invalidateCacheByPrefix(prefix: string): Promise<void> {
  try {
    const allKeys = await (AsyncStorage as any).getAllKeys();
    const target = allKeys.filter((k: string) => k.startsWith(CACHE_PREFIX + prefix));
    if (target.length > 0) {
      await (AsyncStorage as any).multiRemove(target);
    }
  } catch { }
}

/** Clear ALL app cache (e.g. on logout). */
export async function clearAllCache(): Promise<void> {
  try {
    const allKeys = await (AsyncStorage as any).getAllKeys();
    const target = allKeys.filter((k: string) => k.startsWith(CACHE_PREFIX));
    if (target.length > 0) {
      await (AsyncStorage as any).multiRemove(target);
    }
  } catch { }
}
