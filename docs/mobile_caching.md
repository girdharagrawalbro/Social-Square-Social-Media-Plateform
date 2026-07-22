# Mobile App Caching Strategy

The mobile application utilizes a custom cache wrapper built on top of React Native's `@react-native-async-storage/async-storage` (`AsyncStorage`). This system enables offline-first capabilities, reduces API overhead, and ensures snappy UI performance.

The primary implementation resides in [cache.ts](file:///d:/Learning/Social-Square-Social-Media-Plateform/app/src/lib/cache.ts).

---

## 1. How Caching Works

Cache entries are stored in `AsyncStorage` with a specialized JSON structure containing metadata for validation.

### Cache Key Structure
All cache keys are prefixed with a unique namespace:
```typescript
const CACHE_PREFIX = 'ss_cache:';
```
This prefix allows the app to distinguish cache keys from other storage keys (such as auth tokens or user settings) and perform bulk invalidations.

### Cache Entry Structure
Each cache entry is stored as a serialized JSON object of the following interface:
```typescript
interface CacheEntry<T> {
  data: T;      // The actual cached data (payload)
  ts: number;   // Unix timestamp (Date.now()) when cache was written
  ttl: number;  // Time To Live in milliseconds
}
```

When retrieving cached data (`getCache`):
1. The app reads the item from storage.
2. If it exists, it parses the JSON.
3. It checks if the current time exceeds the cache write time + TTL (`Date.now() - entry.ts > entry.ttl`).
4. If expired, it deletes the key asynchronously and returns `null`.
5. If valid, it returns the `data` payload.

---

## 2. What Data is Cached & TTLs (Time To Live)

The app defines specific TTL policies for different types of data under `TTL` constants in `cache.ts`:

| Data Type | Cache Key / Prefix Pattern | TTL (Time To Live) | Purpose |
| :--- | :--- | :--- | :--- |
| **FEED** | `ss_cache:feed` | 5 minutes | Home feed posts listing |
| **STORIES** | `ss_cache:stories` | 3 minutes | Stories strip on home screen |
| **NOTIFICATIONS** | `ss_cache:notifications` | 2 minutes | List of notifications |
| **CONVERSATIONS** | `ss_cache:conversations` | 2 minutes | Inbox/Chat list |
| **MESSAGES** | `ss_cache:chat_messages_*` | 1 minute | Individual room chat messages |
| **PROFILE** | `ss_cache:profile_*` | 30 minutes | Authenticated user profile data |
| **USER_INFO** | `ss_cache:user_*` | 30 minutes | Public profiles / other users' info |
| **EXPLORE** | `ss_cache:explore` | 10 minutes | Search explore/reels grids |
| **FORM_DATA** | `ss_cache:form_*` | 15 minutes | Dropdowns, group lists, select options |
| **ONLINE_STATUS** | `ss_cache:online_*` | 20 seconds | Online status / Last seen indicator |

---

## 3. Invalidation & Deletion Strategy

The caching system supports three levels of cache invalidation:

### Single Key Invalidation
Removes a specific entry instantly (e.g., when a user updates their own profile or posts a new item, the specific profile/feed cache is invalidated).
```typescript
export async function invalidateCache(key: string): Promise<void>
```

### Prefix-based Invalidation (Bulk Deletion)
Invalidates all cache keys that start with a specific namespace. For example, if we update a user's messaging configuration, we can invalidate all message keys starting with `messages_`.
```typescript
export async function invalidateCacheByPrefix(prefix: string): Promise<void>
```
*Behind the scenes*: It fetches all keys in `AsyncStorage`, filters for keys matching `ss_cache:<prefix>`, and deletes them in a batch using `multiRemove`.

### Global Cache Clear
Used on user actions like **Logout** to ensure no stale or sensitive user data is left on the device.
```typescript
export async function clearAllCache(): Promise<void>
```
*Behind the scenes*: It sweeps all keys starting with the global `ss_cache:` prefix and purges them.
