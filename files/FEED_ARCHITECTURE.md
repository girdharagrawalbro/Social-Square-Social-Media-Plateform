# Social Square Feed Architecture & Recommendation Engine

This document outlines the complete architectural flow, source breakdowns, scoring equations, and rules utilized by the **Social Square** feed generation engine inside `backend/routes/post.js`.

---

## 📊 Feed Composition & Source Breakdown

Each feed page request (default `limit: 10`) dynamically blends recent real-time activity, historical discovery, and public confessions tailored to user interests: 

*   **Recent Timeline Posts (70%):** ~7 of 10 posts.
*   **Historical Unseen Pics (20%):** ~2 of 10 posts.
*   **Anonymous Public Confessions (10%):** ~1 of 10 posts.

### 1. Recent Timeline Posts (70%)
*   **Selection:** Chronological database lookup using a high-performance cursor query:
    *   `createdAt < cursorDate` OR (`createdAt == cursorDate` AND `_id < cursorId`).
*   **Filters:** Excludes anonymous posts, soft-deleted posts, time-locked content, and content from blocked/muted users.

### 2. Historical Unseen Pictures (20%)
*   **Selection:** Scans historical database files older than **2 days** that explicitly contain image attachments (`image_url` or non-empty `image_urls`).
*   **Seen-State Deduplication:** Candidates are checked against the Redis Bloom Filter (`bf:seen:${userId}`). Only posts **100% unseen** by the logged-in user are selected.
*   **Dynamic Fallback:** If the system is fresh and not enough historical unseen pictures exist, it gracefully falls back to filling the remaining slots with high-quality recent posts to ensure a seamless scrolling experience.

### 3. Anonymous Public Confessions (10%)
*   **Selection:** Dynamically extracts anonymous confessions (`isAnonymous: true`) matching the user's previously liked category interests.
*   **Seen-State Deduplication:** Like pictures, anonymous confessions are checked against the Redis Bloom Filter so the viewer never sees the same anonymous post twice.
*   **Dynamic Follower Filters (Privacy Guard):** 
    *   Anonymous posts by **public accounts** are globally visible to everyone.
    *   Anonymous posts by **private accounts** are **only** visible in the feed to their authorized followers. The system queries this by evaluating the author's real ID (hidden internally via the `{ select: false }` field `authorId` so it never leaks to the browser).
*   **Dynamic Fallback:** Automatically falls back to fetching general public anonymous posts if there are no interest-matched candidates, or redirects slots back to the recent pool if no confessions are available, guaranteeing a perfect scroll-page density.

---

## 🔄 The Feed Generation Pipeline

1. **User Check:** Load User Profile, Following List & Muted/Blocked IDs.
2. **Fetch Batch 1 (Recent):** Fetch Recent Posts batch based on Cursor.
3. **Fetch Batch 2 (Historical):** Fetch Older Image Posts & Check Redis Bloom Filter.
4. **Combine & Filter:** Combine batches and apply Privacy Guard (Filter out private users whom the viewer does not follow).
5. **Group:** Split into Following Posts vs. Suggested/Explore Posts.
6. **Score & Personalize:** Score and Boost each group based on interest vectors.
7. **Interleave:** Interleave groups with a 2:1 Following-to-Suggestion ratio.
8. **Enforce Diversity:** Ensure Author Diversity by avoiding consecutive posts from the same user.
9. **Online State:** Attach real-time user online presence states.
10. **Cursor Synced:** Calculate & synchronize next cursor and return JSON.

---

## 🧮 Scoring & User Interest Boosting

Once the posts are grouped into **Following** and **Suggestions**, they are sorted according to a dynamic score to prioritize the most engaging and relevant content.

### 1. The Core Engagement Equation
The engagement score of a post is calculated dynamically based on its interactions and age:

$$\text{Score} = \text{Views} + (\text{Likes} \times 2) + (\text{Comments} \times 4) - (\text{Age in Hours} \times 0.5)$$

*   **Views:** +1 point per view.
*   **Likes:** +2 points per like.
*   **Comments:** +4 points per comment (comments are considered high-intent interactions).
*   **Decay:** -0.5 points per hour of age to ensure the feed stays fresh.

### 2. Personalization Interest Boost
If the logged-in user has previously interacted with or liked posts of a specific category, that category is flagged as a high-interest topic:
*   **Category Match:** If `Post.category` matches user's high interest categories, the post receives a flat **+15 point boost**.

---

## 🚫 Diversification Rules

To maintain high user retention and prevent the feed from feeling repetitive, two core filters are applied in real-time during composition:

### 1. Interleaving Ratio
Following posts and Suggestions/Explore posts are merged using a **2:1 slotting pattern**:
*   **Slot 0 & 1:** Reserved for highly ranked posts from **followed users**.
*   **Slot 2:** Reserved for the top-ranking **Suggested post** matching the user's interests.
*   *This repeats infinitely, keeping the feed approximately 66% following and 33% high-intent suggestion content.*

### 2. Back-to-Back Same User Prevention
The engine actively scans the generated feed array. If the next candidate post in line is from the **same author** as the immediately preceding post, the engine bypasses it and pulls the next available high-scoring candidate from a different creator. 

> Note: This rule will only be bypassed if there are literally no other posts from different creators left in the fetched pool, preventing the feed from prematurely stopping.

---

## ⚡ Real-Time Synchronization & State Management

All engagement metrics stay synchronized in real-time via a dual-layer communication model:

1.  **Zustand (Frontend State):** Optimistically updates likes, saved posts, and comments on the client's screen instantly for responsive micro-interactions.
2.  **Socket.io (Real-Time Broadcasts):** 
    *   `newComment`: Invalidation broadcasts immediately trigger local updates in the feed cache, updating comment counts across all active viewers' browsers in real-time.
    *   `postDeleted`: Instantly purges deleted posts from all active feeds without requiring a page refresh.
