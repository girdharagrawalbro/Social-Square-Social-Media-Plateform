# ✨ Social Square

Social Square is a privacy-first, AI-powered social media platform focused on creators. It combines real-time communication, encrypted media sharing, AI-assisted content creation, offline support, and a scalable distributed architecture.

Unlike traditional social platforms, Social Square is built with advanced modern web capabilities:
- **State Synchronization**: Synchronizes state across browser tabs instantly using the Broadcast Channel API (themes, logouts, optimistic updates).
- **Offline-First Messaging**: Provides offline messaging and queuing through IndexedDB; messages seamlessly send when network connectivity is restored.
- **Zero-Knowledge Privacy**: Supports encrypted media uploads (AES-GCM/RSA-OAEP) to protect user images, videos, and voice notes.
- **Resilient Infrastructure**: Transparently falls back to a Google Drive microservice if the primary Cloudinary CDN is unavailable.

## 📊 Project Statistics

**Languages**
- JavaScript, TypeScript

**Frontend**
- React, Zustand, TanStack Query

**Backend**
- Node.js, Express

**Database & Caching**
- MongoDB, Redis, IndexedDB

**Real-Time & Events**
- Socket.io, NATS

**Storage & Jobs**
- Cloudinary, Google Drive (Fallback), BullMQ

**Security**
- AES-GCM, RSA-OAEP Encryption

## 🚀 Features

### Core Implemented Features
*   **Encrypted Feed:** Interactive feed with text and multi-image/video support using client-side AES-GCM encryption.
*   **Story Composer:** Ephemeral stories with auto-save drafts, visibility options, and sticker coordinates cache.
*   **Offline Chat panel:** WhatsApp-style upload abort buttons, offline message queuing, and reconnection/reload retries.
*   **Voice and Video calling:** Low-latency 1-on-1 audio/video calling and multi-follower live streaming powered by **LiveKit SDK**.
*   **Collaborative Wikis:** Collaborative documentation editing, markdown editor, multi-author wiki posts, and revision history tracking.
*   **Creator Goal Tracker:** Public creator roadmaps with milestone creation, progress percentage updates, and social cheers.
*   **Killed Ideas Registry:** A public ledger for creators to share abandoned ideas, reasons for cancellation, and lessons learned.
*   **Real-time Analytics Pulse:** Dynamic trend discovery dashboard showcasing hot categories, trending hashtags, and rising stars.
*   **AI Chatbot with Memory:** NVIDIA API chatbot featuring local RAG (contextual steps from `user_flows.json`) and interest profiling.
*   **AI Moderation & Recommendations:** Automated content safety verification (via `moderationQueue`) and collaborative filtering recommendations.
*   **Communities & Social:** Community groups, post saves, followers list, real-time block/unblock, and notifications.

### Backend Infrastructure Queues (BullMQ)
*   `autoPostQueue`: Delayed and scheduled queue for publishing creator content.
*   `moderationQueue`: Safety verification processor for user posts and confessions.
*   `digestQueue`: Weekly streaks updates, engagement summaries, and newsletters.
*   `cleanupQueue`: Automatically removes expired media, temporary logs, and caches.
*   `emailQueue`: Decoupled background service for transactional OTP and 2FA notifications.

## 🏗️ Architecture & Subsystem Documentation

Deep dives into the technical implementation and design decisions of the system are broken down into specific subsystems:

- [Architecture Overview](docs/Architecture.md)
- [Authentication](docs/Authentication.md)
- [Posts & Upload Flow](docs/Posts.md)
- [Messaging & Offline Chat](docs/Messaging.md)
- [Stories & Ephemeral Content](docs/Stories.md)
- [Notifications](docs/Notifications.md)
- [AI Integrations](docs/AI.md)
- [Storage Architecture](docs/Storage.md)
- [Content Security & E2EE](docs/Content-Security.md)
- [Performance & Caching](docs/Caching.md)
- [Deployment & Scalability](docs/Deployment.md)
- [State Management & Sockets](docs/State.md)
- [Database & Data Stores](docs/Database.md)
- [API Reference](docs/API.md)

## 🧩 Design Patterns

Social Square implements robust enterprise design patterns:
- **Repository Pattern**: Abstracts database interactions.
- **Service Layer**: Encapsulates business logic.
- **Middleware Pipeline**: Handles auth, rate-limiting, and validation.
- **Event-Driven Architecture**: Decouples services via NATS and BullMQ.
- **Optimistic UI**: Provides instant user feedback on the client.

## ⚡ Performance Optimizations

The platform is optimized for a smooth, 60fps experience:
- **Cursor Pagination**: Used for feeds and chat history.
- **Virtualized Lists**: Efficient rendering of long feeds and chats.
- **Image Preloading & Lazy Loading**: Smart resource management.
- **React Memoization**: Prevents unnecessary renders.
- **Broadcast Synchronization**: Eliminates redundant network requests across tabs.
- **Background Refetching & Cache Invalidation**: via TanStack Query.

---

*Built with ❤️ by Girdhar Agrawal*
