# 🌐 Social Square — Production Documentation

Social Square is an AI-integrated social ecosystem built with a "Privacy-First" and "Creator-Centric" philosophy. This document provides a deep-dive into every layer of the application.

---

## 📖 Table of Contents
1.  [🚀 Standardized API Reference](#1-standardized-api-reference)
2.  [⚡ Real-Time Socket Architecture](#2-real-time-socket-architecture)
3.  [🧠 State Management: Zustand (Client State)](#3-state-management-zustand-client-state)
4.  [🌀 State Management: TanStack Query (Server State)](#4-state-management-tanstack-query-server-state)
5.  [🛠️ Technology Stack & Security](#5-technology-stack--security)

---

## 1. Standardized API Reference

All API responses follow the format: `{ "success": true, "data": { ... } }` or `{ "success": false, "message": "..." }`.

### 👤 Authentication & Users (`/api/auth`)

#### **Login User**
- **Endpoint:** `POST /api/auth/login`
- **Payload:**
  ```json
  {
    "identifier": "johndoe@example.com",
    "password": "SecurePassword123",
    "fingerprint": "browser_fingerprint_hash"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "token": "ey...",
    "user": {
      "_id": "64a1b2c3d4e5f6a7b8c9d0e1",
      "username": "johndoe",
      "fullname": "John Doe",
      "email": "john@example.com",
      "profilePicture": "https://...",
      "followersCount": 120,
      "followingCount": 85,
      "isEmailVerified": true
    }
  }
  ```

#### **Search Users**
- **Endpoint:** `POST /api/auth/search`
- **Payload:** `{ "query": "john" }`
- **Response:**
  ```json
  {
    "success": true,
    "users": [
      {
        "_id": "64a1b2c3d4e5f6a7b8c9d0e1",
        "username": "johndoe",
        "fullname": "John Doe",
        "profilePicture": "...",
        "isFollowing": false
      }
    ]
  }
  ```

### 📝 Post Management (`/api/post`)

#### **Create Post**
- **Endpoint:** `POST /api/post/create`
- **Payload:**
  ```json
  {
    "caption": "Hello World!",
    "category": "Photography",
    "imageURLs": ["https://..."],
    "isAnonymous": false,
    "isAiGenerated": true,
    "location": { "name": "New York", "lat": 40.7, "lng": -74.0 }
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "post": {
      "_id": "64b2c3d4e5f6a7b8c9d0e1f2",
      "content": "Hello World!",
      "mediaUrl": "...",
      "author": { "username": "johndoe", "profilePicture": "..." },
      "likesCount": 0,
      "commentsCount": 0,
      "createdAt": "2023-08-24T12:00:00Z"
    }
  }
  ```

#### **Fetch Feed (Cursor Pagination)**
- **Endpoint:** `GET /api/post/feed?limit=10&cursor=timestamp`
- **Response:**
  ```json
  {
    "success": true,
    "posts": [...],
    "nextCursor": "2023-08-24T10:00:00Z",
    "hasMore": true
  }
  ```

---

## 2. Real-Time Socket Architecture

Social Square uses Socket.io with a **Redis Adapter** for cross-instance state synchronization.

### ⬆️ Client -> Server (Emits)
| Event | Payload | Description |
|---|---|---|
| `registerUser` | `userId: string` | Maps `socket.id` to `userId` in Redis. Joins a unique room for private signals. |
| `typing` | `{ recipientId, senderName }` | Sends a volatile "typing" signal to the recipient's room. |
| `messageReaction` | `{ messageId, conversationId, emoji, recipientId }` | Dispatches an emoji reaction update to the active chat room. |
| `readMessage` | `{ messageId, recipientId }` | Signals that a specific message has been viewed. |

### ⬇️ Server -> Client (Listeners)
| Event | Payload | Description |
|---|---|---|
| `userOnline` | `{ userId, socketId }` | Broadcasted when a user connects. Triggers "Green Dot" in UI. |
| `userTyping` | `{ senderName }` | Received by recipient to show "X is typing..." in the chat panel. |
| `seenMessage` | `{ messageId }` | Received by the sender to update the double-checkmark status. |
| `collaborationUpdate`| `{ postId, accepted }` | Real-time update when an invited collaborator accepts/declines. |

---

## 3. State Management: Zustand (Client State)

Zustand manages the **ephemeral lifecycle** of the UI. It is optimized with `devtools` middleware for debugging.

### 🔐 `useAuthStore`
- **State**: `user`, `token`, `initialized`, `loading`.
- **Key Actions**:
  - `initAuth()`: Silent restore of session via `refresh` endpoint on page load.
  - `login(credentials)`: Authenticates and stores JWT in-memory (not localStorage).
  - `followUser(id)`: Optimistically updates the `following` array for instant feedback.

### 🖼️ `usePostStore`
- **State**: `postDetailId`, `isMuted`, `optimisticLikes`, `savedPostIds`.
- **Key Actions**:
  - `optimisticLike(postId)`: Instantly updates the heart icon while the API call is in flight.
  - `rollbackLike(postId)`: Reverts the like if the server request fails.
  - `addSocketPost(post)`: Injects real-time posts directly into the top of the feed list.

---

## 4. State Management: TanStack Query (Server State)

TanStack Query handles the **server source of truth**, providing automatic caching and background synchronization.

### 🛸 Key Hooks
- **`useFeed(userId)`**: Uses `useInfiniteQuery` with a `cursor` based strategy for scroll performance.
- **`useUserProfile(userId)`**: Caches profile data for 5 minutes (`staleTime: 300000`).
- **`useCreatePost()`**: Handles complex multipart uploads and invalidates the `feed` cache upon success.
- **`useNotificationQueries()`**: Periodically refetches notification counts to keep the badge updated.

### ⚡ Caching Strategy
- **Feed/Posts**: 2 minutes `staleTime` | 10 minutes `gcTime`.
- **Auth/Profile**: 5 minutes `staleTime` | 30 minutes `gcTime`.
- **Messages**: 30 seconds `staleTime` (to prioritize fresh conversation threads).

---

## 5. Technology Stack & Security

### Architecture
- **Infrastructure**: Distributed Node.js instances with **NATS** for event distribution.
- **Caching**: **Redis** used for presence (`online_users` hash) and session fingerprints.
- **Workers**: **BullMQ** handles background jobs like daily digests and media cleanup.

### Security Implementation
- **Fingerprinting**: Every login binds the session to a browser fingerprint hash.
- **Rate Limiting**: `express-rate-limit` enforced on all `/api/auth` write operations.
- **Session Revocation**: Remote "Logout from all devices" implemented via session hash invalidation in Redis.
- **2FA**: Email-based OTP mandatory for unrecognized fingerprints/IPs.

---

Built with ❤️ by Girdhar Agrawal & Team.
