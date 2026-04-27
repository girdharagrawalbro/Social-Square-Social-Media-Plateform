# 🌐 Social Square — Production Documentation

Social Square is an AI-integrated social ecosystem built with a "Privacy-First" and "Creator-Centric" philosophy. This document provides a deep-dive into every layer of the application.

---

## 📖 Table of Contents
1.  [🚀 Standardized API Reference](#1-standardized-api-reference)
2.  [🧠 Detailed Feature Specifications](#2-detailed-feature-specifications)
3.  [⚡ Real-Time Socket Architecture](#3-real-time-socket-architecture)
4.  [🛠️ State Management: Zustand (Client State)](#4-state-management-zustand-client-state)
5.  [🌀 State Management: TanStack Query (Server State)](#5-state-management-tanstack-query-server-state)
6.  [☁️ Media Uploading Ecosystem](#6-media-uploading-ecosystem)
7.  [🛠️ Technology Stack & Security](#7-technology-stack--security)

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

### 🧠 AI Services (`/api/ai`)

#### **Generate Text (Magic Post)**
- **Endpoint:** `POST /api/ai/generate-text`
- **Payload:**
  ```json
  {
    "prompt": "Give me a motivational quote about coding."
  }
  ```
- **Description:** Generates engaging text captions using the NVIDIA API.

#### **Generate Image**
- **Endpoint:** `POST /api/ai/generate-image`
- **Payload:**
  ```json
  {
    "prompt": "A futuristic city with neon lights"
  }
  ```
- **Description:** Generates high-quality images and uploads them directly to Cloudinary.

#### **Suggest Metadata**
- **Endpoint:** `POST /api/ai/suggest-meta`
- **Payload:** `{ "caption": "Beautiful sunset!" }`
- **Description:** Uses AI to recommend hashtags, pick categories, and detect mood.

#### **AI Direct Post**
- **Endpoint:** `POST /api/ai/generate-and-post`
- **Payload:** `{ "prompt": "...", "makeAnonymous": false }`
- **Description:** Generates text + image and posts to feed in a single background transaction.

### 🎬 Story Management (`/api/story`)

#### **Create Story**
- **Endpoint:** `POST /api/story/create`
- **Payload:**
  ```json
  {
    "mediaUrl": "https://...",
    "mediaType": "image",
    "text": { "content": "Hello!", "color": "#fff", "position": 10 },
    "sharedPostId": null
  }
  ```

#### **Fetch Stories Feed**
- **Endpoint:** `GET /api/story/feed`
- **Description:** Fetches active stories grouped by user, ordered by unviewed status.

#### **Reply to Story (DM)**
- **Endpoint:** `POST /api/story/reply/:storyId`
- **Payload:** `{ "content": "Great shot!" }`

### 👥 Group Management (`/api/group`)

#### **Create Group**
- **Endpoint:** `POST /api/group/create`
- **Payload:** `{ "name": "Tech Talk", "isPrivate": false }`

---

## 2. Detailed Feature Specifications

Social Square is packed with cutting-edge features designed for modern social interaction.

### 🧠 AI Suite & Creator Tools
- **AI Magic Post**: Generates complete posts (text + image) from simple user prompts using NVIDIA models.
- **Smart Metadata**: Automatically extracts hashtags, categories, and detects mood using Gemini AI.
- **Usage Guardrails**: Hard limits of **2 Text / 2 Image generations per user per day** to balance API costs.

### 🎬 Stories & Ephemeral Content
- **24h Lifecycle**: Backed by MongoDB TTL indexes ensuring automatic backend cleanup.
- **Background Processing**: Uploads large media invisibly via queued Promises while returning UI control immediately.

### 💬 Advanced Messaging Ecosystem
- **SSE Chat integration**: High-performance Server-Sent Events drive real-time video stream commentary.
- **Cross-instance Pub/Sub**: Bridged by Redis to route private signals accurately across clusters.

### 👥 Collaborative Dynamics
- **Public vs Private Spaces**: Dynamic visibility permissions for group contexts.
- **Interactive Polls**: Real-time voting feedback backed by Socket updates.

---

## 3. Real-Time Socket Architecture

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

## 4. State Management: Zustand (Client State)

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

### 💬 `useConversationStore`
- **State**: `activeConversationId`, `onlineUserIds`, `typingUsers`, `unreadCounts`, `socketMessages`.
- **Key Actions**:
  - `openChat(id, participant)`: Sets the currently active DM target.
  - `addSocketMessage(id, msg)`: Appends incoming real-time messages securely.

---

## 5. State Management: TanStack Query (Server State)

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

## 6. Media Uploading Ecosystem

Social Square leverages a dual-storage media pipeline to guarantee uptime and high-speed delivery.

### ☁️ Cloudinary + Drive Fallback
- **Primary Target**: Cloudinary (Public CDN optimization).
- **Background Sync**: Successful uploads trigger fire-and-forget backups to Google Drive.
- **Transparency Fallback**: Files breaching size constraints (**20MB Image / 100MB Video**) bypass Cloudinary constraints and flow securely into Google Drive.

### 🎥 Video Processing & Making
- **Client-Side Thumbnails**: Utilizes the browser Canvas API at frame seek `currentTime=1`.
- **Trimming Utilities**: Supports granular post-processing configurations.

---

## 7. Technology Stack & Security

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
