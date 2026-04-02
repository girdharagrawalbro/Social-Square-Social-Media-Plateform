# 🌐 Social Square — AI-Powered Social Media Platform

Social Square is a modern, full-stack social media platform that combines AI-powered content tools, real-time communication, premium dark-mode UI, and advanced security. Built for creators, communities, and meaningful connections.

---

## ✅ Feature Audit — What's Implemented

### 🔍 Discovery & Engagement

| Feature | Status | Notes |
|---|---|---|
| Search & Explore Page | ✅ Implemented | `Search.js` + `Explore.js` — user/post/hashtag search via `/api/auth/search` |
| Trending Topics | ✅ Implemented | `/api/post/trending` — aggregates top categories by score over 7 days |
| User Discovery | ✅ Implemented | `OtherUsers.js` — AI-powered "People You May Know" with dismiss |
| Ranked/Algorithmic Feed | ✅ Implemented | Feed ranked by likes × 2 + comments × 3 + following boost + category affinity |
| Save / Bookmark Posts | ✅ Implemented | Full save/unsave toggle on posts and profile saved tab |
| Mood-Based Feed | ✅ Implemented | `MoodFeedToggle.js` — filter feed by AI-detected post mood |
| Emoji Reactions | ❌ Not Implemented | Only heart likes currently. Planned: emoji reactions (👍❤️😂😮😢😡) |
| Polls / Quizzes in Posts | ❌ Not Implemented | Planned feature — no Post model fields yet |

---

### 👥 Social Graph

| Feature | Status | Notes |
|---|---|---|
| Follow / Unfollow | ✅ Implemented | `/api/auth/follow` and `/api/auth/unfollow` |
| Private Accounts | ✅ Implemented | Follow request → accept/decline flow + profile lock |
| Follow Suggestions | ✅ Implemented | `suggestionService.js` — mutual network, category interest, dismiss |
| Follower/Following Lists | ✅ Implemented | `FollowFollowingList.js` — view followers/following in UserProfile |
| Mutual Follower Badges | ✅ Implemented | "Followed by X and N others" shown on UserProfile |
| Collaborative Posts | ✅ Implemented | Invite collaborators, accept/decline, contribution tracking |
| Groups / Communities | ❌ Not Implemented | Planned — no Group model yet |
| Verified Badges / Creator Tiers | ❌ Not Implemented | No `isVerified` field yet. Planned for creator roadmap |
| Block / Mute Users | ❌ Not Implemented | Dismiss user exists (`dismissedUsers`) but no full block/mute |

---

### 🔔 Notifications & Retention

| Feature | Status | Notes |
|---|---|---|
| Real-Time Notifications | ✅ Implemented | Socket.io — likes, comments, follows, new posts, collab invites |
| In-App Notification Bell | ✅ Implemented | `NotificationBell.js` — tabbed (all / unread), mark read |
| Email Notifications | ✅ Implemented | New device alert, lockout, session revoked, password reset emails |
| Weekly Email Digest | ✅ Implemented (Backend) | `digestQueue.js` — BullMQ job for weekly activity digest; user toggle in settings |
| Notification Settings | ✅ Implemented | `/api/auth/notification-settings` — `emailDigest` + `pushEnabled` toggles |
| Push Notifications (PWA) | ❌ Not Implemented | `manifest.json` exists. Service worker / Web Push API not wired up yet |
| Streaks / Gamification | ❌ Not Implemented | Planned — no streak tracking model yet |

---

### 🛡️ Moderation & Trust

| Feature | Status | Notes |
|---|---|---|
| Content Reporting | ✅ Implemented | `ReportDialog.js` + `/api/admin/report` — 7 categories (spam, hate speech, nudity, etc.) |
| Admin Report Dashboard | ✅ Implemented | `AdminDashboard.js` — review, resolve, and dismiss reports |
| User Banning | ✅ Implemented | Admin can ban users — `isBanned`, `banReason`, `bannedAt` in User model |
| Post Moderation | ✅ Implemented | Admin can delete posts, see reported content filter |
| Keyword / Spam Filtering | ❌ Not Implemented | Planned — no content filter middleware yet |
| Block / Mute | ❌ Not Implemented | `dismissedUsers` field partially addresses this for suggestions only |

---

### 🤖 AI & Intelligence

| Feature | Status | Notes |
|---|---|---|
| AI Caption Generation | ✅ Implemented | NVIDIA Llama 3 + Google Gemini 2.0 with intelligent fallback |
| AI Image Generation | ✅ Implemented | NVIDIA Stable Diffusion via `/api/ai/generate-image` |
| Mood Detection | ✅ Implemented | Auto-classifies post mood (happy, sad, excited, etc.) on creation |
| AI Chatbot (SocialBot) | ✅ Implemented | `Chatbot.js` — Mistral AI powered assistant for platform help & captions |
| Personalized Recommendations | ✅ Implemented | Redis + BullMQ + `recommenderWorker.js` — activity-based post scoring |
| AI-Generated Post Badge | ✅ Implemented | `isAiGenerated` flag tracked on Post model |

---

### 📱 Content & Stories

| Feature | Status | Notes |
|---|---|---|
| Multi-Image Posts | ✅ Implemented | Up to N images per post via `image_urls[]` |
| Voice Notes on Posts | ✅ Implemented | Record & attach audio voice notes — stored on Cloudinary |
| 24h Stories | ✅ Implemented | `Stories.js` — auto-expire, tap/swipe viewer, pause-on-hold |
| Story Reactions | ✅ Implemented | Emoji reaction button in story viewer |
| Story → Post Share | ✅ Implemented | Share any feed post directly to your story |
| Live Streaming | ✅ Implemented | `LiveStream.js` — WebRTC peer-to-peer, viewer count |
| Anonymous Confessions | ✅ Implemented | Identity fully hidden, separate confessions feed |
| Time-Locked Posts | ✅ Implemented | Content locked until `unlocksAt` datetime |
| Ephemeral / Auto-Delete Posts | ✅ Implemented | `expiresAt` + MongoDB TTL index — posts auto-delete |
| Post Categories & Tags | ✅ Implemented | Required category + optional tag array on every post |
| Music Metadata | ✅ Implemented | Attach song title + artist to any post |
| Location Tagging | ✅ Implemented | Optional lat/lng + name on posts |

---

### 💬 Communication

| Feature | Status | Notes |
|---|---|---|
| Real-Time Private Chat | ✅ Implemented | `ChatPanel.js` + Socket.io — text, image, voice, video, reactions |
| Message Reactions | ✅ Implemented | Emoji reactions on individual chat messages |
| Read Receipts | ✅ Implemented | Message seen status in conversations |
| Typing Indicators | ✅ Implemented | Real-time "is typing..." in chat |
| Online / Last Seen | ✅ Implemented | `isOnline` + `lastSeen` fields on User model |
| Conversations List | ✅ Implemented | `Conversations.js` — smart panel with search, pinning, unread count |
| Groups/Channels | ❌ Not Implemented | Only 1-on-1 chat supported currently |

---

### 🔒 Security & Privacy

| Feature | Status | Notes |
|---|---|---|
| JWT Auth + Refresh Tokens | ✅ Implemented | Silent token rotation with reuse detection |
| Browser Fingerprinting | ✅ Implemented | Fingerprint-locked sessions |
| 2FA (OTP via Email) | ✅ Implemented | Time-limited 6-digit OTP on login |
| Rate Limiting | ✅ Implemented | `authRateLimiter` middleware on auth routes |
| Account Lockout | ✅ Implemented | 30-min lockout after 5 failed login attempts |
| New Device Alerts | ✅ Implemented | Email alert on login from unrecognized device/IP |
| Session Management | ✅ Implemented | `ActiveSessions.js` — view, revoke individual or all sessions |
| Private Account Mode | ✅ Implemented | Follow request gating for private profiles |
| Password Strength Meter | ✅ Implemented | `PasswordStrengthMeter.js` on signup |
| Google OAuth | ✅ Implemented | One-click Google sign-in |
| Email Verification | ✅ Implemented | Token-based email verification on signup |

---

### 🎨 UI/UX & Accessibility

| Feature | Status | Notes |
|---|---|---|
| Dark / Light Mode Toggle | ✅ Implemented | Full CSS variable system — toggle in Navbar |
| Responsive / Mobile Layout | ✅ Implemented | Adapts between desktop and mobile |
| Infinite Scroll Feed | ✅ Implemented | Cursor-based pagination with TanStack Query |
| Post Detail Modal | ✅ Implemented | Full-featured modal with 3-dot menu, similar posts |
| Premium Design System | ✅ Implemented | Glassmorphism, micro-animations, Inter/Outfit fonts |
| Skeleton Loaders | ✅ Implemented | Wave-shimmer skeletons on all major loading states |
| Toast Notifications | ✅ Implemented | `react-hot-toast` for all user feedback |
| PWA Manifest | ✅ Basic | `manifest.json` present but service worker not wired |
| Offline Support | ❌ Not Implemented | Service worker / cache strategy not implemented |
| Accessibility (a11y) | ❌ Partial | Semantic HTML used, but no ARIA labels, focus management, or screen reader testing |

---

### 📊 Creator & Admin Tools

| Feature | Status | Notes |
|---|---|---|
| Admin Dashboard | ✅ Implemented | Full analytics — users, posts, reports, bans, digest trigger |
| Profile View Tracking | ✅ Implemented | `profileViews` counter incremented on every profile visit |
| Post View Tracking | ✅ Implemented | View count shown on posts, tracked for recommendations |
| Creator Analytics Dashboard | ❌ Not Implemented | `Analytics.js` model exists but no user-facing dashboard |
| Bookmark Collections | ❌ Not Implemented | Saves are flat — no named collection support yet |

---

## 🛠️ Full Technology Stack

### Backend
- **Runtime**: Node.js + Express.js
- **Database**: MongoDB (Mongoose ODM) + Redis (caching, queues)
- **Real-Time**: Socket.io (notifications, chat, live, collab invites)
- **Queues**: BullMQ — email digest, cleanup, recommendation workers
- **AI/ML**: NVIDIA AI Foundation (Llama 3, Stable Diffusion), Google Gemini 2.0, Mistral AI
- **Cloud Storage**: Cloudinary (image, voice note, video assets)
- **Email**: Nodemailer (new device, digest, OTP, password reset, session alert)
- **Auth**: JWT (access + refresh token rotation), bcryptjs, crypto, fingerprinting
- **Messaging**: NATS (event publish for recommendation pipeline)
- **Validation**: express-validator

### Backend Routes Summary
| Route Base | Purpose |
|---|---|
| `/api/auth` | Registration, login, 2FA, OAuth, follow/unfollow, search, notifications |
| `/api/post` | Feed, create/update/delete, like, comments, save, trending, confessions |
| `/api/story` | Story CRUD, reactions, sharing |
| `/api/conversation` | Chat, messages, media, reactions, read receipts |
| `/api/ai` | Caption gen, image gen, mood detection, chatbot |
| `/api/admin` | Dashboard stats, user management, report review, digest |
| `/api/recommendation` | Personalized post recommendations |
| `/api/live` | WebRTC live stream room management |

### Frontend
- **Framework**: React.js (Create React App)
- **State**: Zustand (auth + post global state)
- **Data Fetching**: TanStack Query (React Query) — caching, pagination, mutations
- **UI**: Vanilla CSS + CSS Variables + PrimeReact (with custom dark-mode overrides)
- **Animation**: Framer Motion
- **Routing**: React Router v6
- **Notifications**: react-hot-toast
- **SEO**: react-helmet-async

---

## 🗺️ Roadmap (Planned Features)

- [ ] Emoji reactions on posts (❤️ 😂 😢 😡 👏)
- [ ] Polls and quizzes in posts
- [ ] Groups / Communities
- [ ] Block / Mute users
- [ ] Creator analytics dashboard (per-post stats, audience insights)
- [ ] Bookmark collections (named save folders)
- [ ] PWA service worker + Web Push notifications
- [ ] Verified badge + creator tier system
- [ ] Keyword / spam content filtering
- [ ] Streak / gamification system
- [ ] Full accessibility (WCAG 2.1 AA)

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- MongoDB Atlas or Local
- Redis instance
- API Keys: NVIDIA, Google Gemini, Mistral AI, Cloudinary

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/girdharagrawalbro/Social-Square-Social-Media-Plateform.git
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   # Configure .env (see .env.example)
   npm run dev
   ```

3. **Setup Frontend**
   ```bash
   cd socialsquare
   npm install
   # Set REACT_APP_BACKEND_URL in .env
   npm start
   ```

---

Built with ❤️ by Girdhar Agrawal & Team.
