# State Management

Social Square employs a multi-tiered state management architecture to ensure instantaneous feedback, offline capabilities, and cross-tab synchronization.

## 1. Client UI State (Zustand)
Zustand manages the **ephemeral lifecycle** of the UI without unnecessary re-renders.
- **Auth Store**: Manages the active user token and initialization status.
- **Post Store**: Handles draft states, optimistic UI updates (e.g., instant heart animation on like), and temporary local modifications before API confirmation.

## 2. Server Caching State (TanStack Query)
TanStack Query manages the asynchronous state fetched from the backend.
- **Caching**: Stores feeds, profiles, and notifications with configurable `staleTime` and `gcTime`.
- **Background Refetching**: Automatically updates stale data when the window regains focus or reconnects to the network.
- **Pagination**: Manages cursor-based infinite scrolling seamlessly.

## 3. Real-Time Server-to-Client State (Socket.io)
Socket.io (backed by a Redis Adapter) pushes real-time events across horizontally scaled instances.
- **Presence**: Live online/offline tracking.
- **Live Events**: Typing indicators, new messages, and instant push notifications (likes, follows, collaborator invites).

## 4. Cross-Tab State (Broadcast Channel API)
The `appChannel` synchronizes state entirely on the client-side across multiple browser tabs without hitting the backend.
- **Theme Sync**: Toggling dark mode in one tab updates all others instantly.
- **Session Sync**: A logout in Tab A instantly destroys the session in Tab B.
- **Interaction Sync**: Liking a post or updating the profile picture reflects across all open tabs simultaneously.
