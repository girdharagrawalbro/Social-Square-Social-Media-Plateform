/**
 * Single source of truth for every React Query key in the app. Before this file,
 * keys were hand-typed string arrays at each call site — the query definition in one
 * file and its `invalidateQueries` calls in others, with nothing checking they
 * actually matched. Auditing every call site while building this turned up a real
 * bug: three `invalidateQueries` calls in ChatPaneScreen targeted `'chat_messages'`,
 * but the actual query is keyed `'messages'` — those invalidations were silent
 * no-ops (delete-failure recovery and the E2EE-password refetch never fired; both
 * self-healed within the 20s poll interval instead of firing immediately).
 *
 * Note on `profile`/`profilePosts`/`activeSessions`/`notifications`/`follows`/`goals`:
 * these are only ever *invalidated* (from lib/socket.ts and GoalCreateScreen), never
 * defined via useQuery anywhere in the app today — those screens fetch through the
 * separate TTL cache in lib/cache.ts instead. Centralizing them here doesn't make
 * those invalidations do anything they don't already do; it just means if any of
 * those screens adopt React Query later, the key is already correct everywhere that
 * invalidates it.
 */

export const queryKeys = {
  /** One mood's feed (or the default feed when mood is null/undefined). */
  feed: (mood?: string | null) => ['feed', mood ?? null] as const,
  /** Matches every mood variant at once — for broad invalidation/setQueriesData only. */
  feedAll: () => ['feed'] as const,

  conversations: () => ['conversations'] as const,

  messages: (conversationId?: string) => ['messages', conversationId] as const,

  onlineStatus: (userId?: string) => ['online-status', userId] as const,

  profile: (userId?: string) => ['profile', userId] as const,
  /** Matches every user's profile query at once — broad invalidation only (e.g. followUpdate). */
  profileAll: () => ['profile'] as const,
  profilePosts: (userId?: string) => ['profile_posts', userId] as const,

  notifications: () => ['notifications'] as const,
  activeSessions: () => ['active_sessions'] as const,
  follows: () => ['follows'] as const,
  goals: (userId?: string) => ['goals', userId] as const,
} as const;
