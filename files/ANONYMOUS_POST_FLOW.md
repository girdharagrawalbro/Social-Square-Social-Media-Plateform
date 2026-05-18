# Anonymous Post (Confessions) Flow - Technical Documentation

This document outlines the complete lifecycle and visibility of anonymous posts (confessions) within the Social Square platform.

## 1. Post Creation Flow
When a user decides to post anonymously:

1.  **UI Trigger**: The user toggles the "Post Anonymously" switch in the create post screen.
2.  **API Request**: The frontend sends a `POST` request to `/api/posts/create` with the field `isAnonymous: true`.
3.  **Identity Masking (Storage Level)**:
    *   The backend validates the user's token but **overwrites** the display information in the post document:
        *   `fullname` is set to `"Anonymous"`.
        *   `profile_picture` is set to a default generic avatar.
    *   The actual `user._id` is still stored in the database for ownership tracking (allowing the user to see/delete their own posts).
4.  **Notification Suppression**:
    *   Normal posts trigger a NATS event to notify followers. **Anonymous posts skip this event**, ensuring followers don't get a notification saying "User X just posted".
5.  **Real-time Broadcast**:
    *   A specific Socket.io event `newConfessionPost` is emitted to all connected clients, allowing the Confessions feed to update in real-time without revealing the author.

## 2. Feed Visibility
Anonymous posts are strictly partitioned and governed by custom privacy rules:

*   **Main Feed**: Blended (10%). Exactly **1 of every 10 posts (10%)** in the homepage feed can be a public anonymous confession post, provided it matches the viewer's category interests. If interest candidates are scarce, it gracefully falls back to general public anonymous posts or fills the slot with normal posts.
*   **Explore/Reels**: Excluded. Recommendation engines and the Explore feed filter out anonymous content to maintain a person-centric discovery experience.
*   **Confessions Feed**: Included. This is the primary aggregator for all anonymous posts, accessible via `GET /api/posts/confessions`.

## 3. Privacy Protection & Follower Filtering (Privacy Guard)
To prevent identity leaks and honor user-level security profiles, the system implements the following rigorous boundaries:

1.  **Storage Isolation**:
    *   `user._id` inside the post is stored as a global static dummy `ANONYMOUS_USER_ID` (`"600000000000000000000000"`).
    *   The real author's ID is stored in the hidden field `authorId` which has `{ select: false }` set in Mongoose. It is completely inaccessible to API queries unless explicitly loaded for server-side calculations.
2.  **Follower Enforcement for Private Accounts**:
    *   If a **private user** creates an anonymous confession (either manually or via the AI post generator), it is strictly hidden from non-followers or guests in **both** the Confessions Feed and the Main Feed.
    *   Only their confirmed followers are allowed to see it. The system queries follower states efficiently in Redis using `getRestrictedUserIds`.
3.  **Sanitization layer**:
    *   `sanitizeAnonymousPost` strips all identifying parameters (such as `authorId` or local ownership parameters) before serving responses to the browser.

## 4. User Profile Integration
How anonymous posts appear on profiles:

### A. Your Own Profile (Self View)
*   **Visibility**: You **can** see your own anonymous posts in your post list.
*   **Why**: This allows you to track engagement (likes/comments) and manage (delete) your confessions.
*   **Backend Logic**: The profile query checks `if (viewerId === ownerId)`, it includes `isAnonymous` posts.

### B. Other's Profile (Public View)
*   **Visibility**: **Hidden**. Anonymous posts are strictly excluded when someone else views your profile.
*   **Result**: No one can visit your profile to see what "anonymous" things you've posted. Your public profile only shows your identity-linked content.

### C. Logged-out (Guest) View
*   **Visibility**: **Hidden**. Public profile pages never show anonymous content.

## 5. Interactions & Notifications
*   **Likes/Reactions**: Users can react to anonymous posts.
*   **Notifications**: If someone likes or comments on your confession:
    *   You **receive** a notification.
    *   The notification correctly identifies the post, but because it's your confession, only you see it in your notification tray.
    *   The backend routes the notification to the hidden `user._id` stored in the post.

## 6. Summary Table

| Context | Visible? | Author Identity | Privacy/Follower Check |
| :--- | :--- | :--- | :--- |
| **Main Feed** | Blended (10%) | Hidden ("Anonymous") | Excludes private accounts not followed by viewer |
| **Confessions Feed** | Yes | Hidden ("Anonymous") | Excludes private accounts not followed by viewer |
| **Your Own Profile** | Yes | Shown to you only | None (self) |
| **Other's Profile** | No | N/A | N/A |
| **Search Results** | No | N/A | N/A |
| **Direct Post Link** | Yes | Hidden ("Anonymous") | Excludes private accounts not followed by viewer |

---
*Note: This flow ensures that while the system knows who you are (for moderation and ownership), the community only ever sees "Anonymous".*
