# 🌐 Social Square — AI-Powered Social Media Platform

Social Square is a modern, full-stack social media platform that combines AI-powered content tools, real-time communication, premium dark-mode UI, and advanced security. Built for creators, communities, and meaningful connections.

---

## 📖 Table of Contents
1.  [🚀 Main Overview & Tech Stack](#-main-overview--tech-stack)
2.  [🧩 Standardized API Documentation](#-standardized-api-documentation)
3.  [⚡ Real-Time Architecture (Socket.io)](#-real-time-architecture-socketio)
4.  [🧠 State Management (Zustand & TanStack Query)](#-state-management-zustand--tanstack-query)
5.  [🛠️ Getting Started](#%EF%B8%8F-getting-started)

---

## 🚀 Main Overview & Tech Stack

### Key Features
- **AI Magic Post**: Generate stunning images and engaging captions in one click using NVIDIA Llama 3 and Stable Diffusion.
- **Real-Time Communication**: Instant messaging with voice notes, video, and emoji reactions.
- **Dynamic Feed**: An algorithmic feed ranked by engagement (likes, comments) and category affinity.
- **Advanced Security**: 2FA (OTP via email), JWT session management with fingerprinting, and account lockout protection.
- **Privacy First**: Private account modes, anonymous confessions, and ephemeral (auto-delete) posts.

### Backend Stack
- **Runtime**: Node.js + Express.js
- **Database**: MongoDB (Mongoose) + Redis (Caching & Queues)
- **Real-Time**: Socket.io (Bi-directional communication)
- **Queues**: BullMQ (Email digests, background cleanup)
- **AI/ML**: NVIDIA AI Foundation, Google Gemini 2.0, Mistral AI
- **Cloud Storage**: Cloudinary (Media assets)

### Frontend Stack
- **Framework**: React.js
- **State**: Zustand (Global Auth & UI State)
- **Data Fetching**: TanStack Query (Server State, Caching, Pagination)
- **UI**: Vanilla CSS + PrimeReact (Customized)
- **Animations**: Framer Motion

---

## 🧩 Standardized API Documentation

All endpoints return a `success: boolean` flag and use consistent object shapes.

### 👤 Global Schemas
| Schema | Description | Key Fields |
|---|---|---|
| **UserLite** | Compact user info for lists/feeds | `_id`, `username`, `fullname`, `profilePicture` |
| **UserFull** | Detailed profile data | `email`, `bio`, `followersCount`, `followingCount`, `isFollowing` |
| **PostStandard** | Core post data | `content`, `mediaUrl`, `category`, `author`, `likesCount`, `isLiked` |

### 🔐 Authentication (`/api/auth`)
- `POST /register`: Returns `{ success, user: UserFull, token }`
- `POST /login`: Returns `{ success, user: UserFull, token }`
- `POST /search`: Returns `{ success, users: UserLite[] }`
- `POST /follow`: Returns `{ success, action: 'followed'|'unfollowed', isFollowing }`

### 📝 Post Management (`/api/post`)
- `GET /feed`: Cursor-based pagination. Returns `{ success, posts: PostStandard[], pagination }`
- `POST /create`: Returns `{ success, post: PostStandard }`
- `POST /like`: Toggles like state.

### 💬 Messaging (`/api/conversation`)
- `GET /list`: Returns active conversations with `lastMessage` and `unreadCount`.
- `POST /messages`: Fetch thread. Returns `{ success, messages: Message[], nextCursor }`
- `POST /send`: Returns the newly created `Message` object.

---

## ⚡ Real-Time Architecture (Socket.io)

Social Square uses Socket.io for all live interactions. The backend is backed by **Redis** to ensure stable presence tracking.

### Client -> Server Events
| Event | Payload | Description |
|---|---|---|
| `registerUser` | `userId` | Joins a personal room and marks the user as Online. |
| `typing` | `{ recipientId, senderName }` | Triggers "Typing..." indicator for the recipient. |
| `stopTyping` | `{ recipientId }` | Removes typing indicator. |
| `readMessage` | `{ messageId, recipientId }` | Updates read status in real-time. |
| `messageReaction` | `{ messageId, conversationId, reactions, recipientId }` | Syncs emoji reactions across clients. |

### Server -> Client Events
| Event | Payload | Description |
|---|---|---|
| `userOnline` | `{ userId, socketId }` | Notifies friends that a user just came online. |
| `updateUserList` | `OnlineUser[]` | Syncs the global online status list. |
| `userTyping` | `{ senderName }` | Shows the typing indicator in the chat panel. |
| `seenMessage` | `{ messageId }` | Updates the checkmark to "Read" in the sender's UI. |

---

## 🧠 State Management (Zustand & TanStack Query)

The platform follows a clear separation between **Client State** and **Server State**.

### 1. Zustand (Client State)
Zustand is used for high-frequency, non-persisted UI state and Auth session management.
- **`useAuthStore`**: Manages the logged-in user object, JWT tokens, and login/logout logic.
- **`usePostStore`**: Handles temporary UI states during post creation (selected images, draft captions).
- **`useConversationStore`**: Manages the active chat window, unread badge totals, and typing status.

### 2. TanStack Query (Server State)
Used for all API interactions to provide caching, background revalidation, and infinite scroll.
- **Caching**: Feed posts and user profiles are cached for 5 minutes.
- **Infinite Scroll**: `usePostQueries.js` implements `useInfiniteQuery` for seamless feed scrolling.
- **Optimistic Updates**: Likes and follow actions use optimistic updates, providing an instant UI response while the server processes the request.
- **Automatic Refetching**: Notifications are refetched in the background to ensure the badge count is always accurate.

---

## 🛠️ Getting Started

### 1. Backend Setup
```bash
cd backend
npm install
# Set REDIS_URL, MONGODB_URI, and AI_KEYS in .env
npm run dev
```

### 2. Frontend Setup
```bash
cd socialsquare
npm install
npm start
```

---

Built with ❤️ by Girdhar Agrawal & Team.
