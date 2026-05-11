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
Anonymous posts are strictly partitioned from normal social content:

*   **Main Feed**: Excluded. The query for the main feed explicitly filters out posts where `isAnonymous: true`.
*   **Explore/Reels**: Excluded. Recommendation engines and the Explore feed filter out anonymous content to maintain a high-quality, person-centric discovery experience.
*   **Confessions Feed**: Included. This is the **only** public place where these posts appear. It is accessible via `GET /api/posts/confessions`.

## 3. Privacy Protection (Sanitization)
To prevent accidental identity leaks through API responses, the `sanitizePost` utility and Mongoose `toJSON` transforms are used:

*   **For the Author**: When you view your own anonymous post, you still see your real `user._id` (masked as "Owner" in some logic) so the app knows you have permission to edit/delete it.
*   **For Other Users**:
    *   `user._id` is hard-coded to `"anonymous_user"` or `null` in the API response.
    *   `collaborators` list is cleared (since anonymity and collaboration are mutually exclusive).
    *   Display name and picture remain "Anonymous".

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

| Context | Visible? | Author Identity |
| :--- | :--- | :--- |
| **Main Feed** | No | N/A |
| **Confessions Feed** | Yes | Hidden ("Anonymous") |
| **Your Own Profile** | Yes | Shown to you only |
| **Other's Profile** | No | N/A |
| **Search Results** | No | N/A |
| **Direct Post Link** | Yes | Hidden ("Anonymous") |

---
*Note: This flow ensures that while the system knows who you are (for moderation and ownership), the community only ever sees "Anonymous".*
