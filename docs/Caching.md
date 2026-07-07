# Performance & Caching

## Performance Optimizations
The platform employs several techniques to ensure a smooth, 60fps experience for users:

- **Cursor Pagination**: Used for feed and comments to efficiently load data without skipping or duplicating records.
- **Lazy Loading & Infinite Scrolling**: Defers loading of off-screen components and data.
- **Image Preloading**: Anticipates user scroll to load images before they enter the viewport.
- **Virtualized Lists**: Only renders DOM nodes for visible items in long lists (e.g., chat history, feed).
- **React Memoization**: `React.memo`, `useMemo`, and `useCallback` prevent unnecessary re-renders.
- **Optimistic Updates**: UI updates instantly (e.g., likes, follows) while the API request is in flight.
- **Broadcast Synchronization**: The Broadcast Channel API syncs state (theme, likes, drafts) across tabs without additional network requests.

## Caching Strategy

### Problem
Minimizing database load while serving data instantly to distributed clients.

### Implementation
- **Redis (Server)**:
  - Purpose: Presence (`online_users`), session cache, socket mapping, rate limiting.
- **TanStack Query (Client)**:
  - Feed/Posts: 2 minutes `staleTime` | 10 minutes `gcTime`.
  - Auth/Profile: 5 minutes `staleTime` | 30 minutes `gcTime`.
  - Messages: 30 seconds `staleTime`.
- **IndexedDB (Local)**:
  - Instant Feed Hydration on initial load.
  - Offline message caching.

### Benefits
- Sub-second load times.
- Reduced infrastructure costs.
- Resilience against brief network outages.
