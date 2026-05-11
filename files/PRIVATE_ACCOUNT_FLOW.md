# Private Account Flow - Technical Documentation

This document describes how private accounts and follow requests are handled across the Social Square platform, including visibility rules and content protection.

## 1. Enabling Privacy
A user can make their account private through the profile settings.
*   **API**: `PUT /api/auth/update-profile`
*   **Field**: `isPrivate: true`
*   **Effect**: Once enabled, content (posts, stories) and social lists (followers/following) are restricted to approved followers only.

## 2. Follow Request Lifecycle

### A. Sending a Request
*   **API**: `POST /api/auth/follow`
*   **Logic**: 
    *   If the target user is **public**: Immediate follow (adds to `followers` list).
    *   If the target user is **private**: The requester is added to the `followRequests` array.
*   **Notification**: A `follow_request` notification is sent to the target user.

### B. Managing Incoming Requests
The private user sees pending requests and can take the following actions:
*   **Accept**: `POST /api/auth/follow-request/accept`
    *   Moves requester from `followRequests` to `followers`.
    *   Increments counts for both users.
    *   Sends `follow_accept` notification to the requester.
*   **Decline**: `POST /api/auth/follow-request/decline`
    *   Removes requester from `followRequests`.
    *   Sends `follow_decline` notification.
*   **Cancel (by Requester)**: `POST /api/auth/follow-request/cancel`
    *   Allows the requester to withdraw their pending request.

## 3. Profile Visibility Rules
Access to user data is governed by the `canSeeDetails` logic in the backend.

### Profile Headers
*   **API**: `GET /api/auth/other-user/view/:id`
*   **Rules**:
    *   **Basic Info** (Name, Bio, Counts): Always visible.
    *   **Followers/Following Lists**: Hidden if the account is private and the viewer is not a follower.
    *   **Mutual Followers**: Still calculated and shown to help the viewer decide whether to request.

### Content (Posts & Media)
*   **API**: `GET /api/posts/user/:userId`
*   **Rules**:
    *   If the account is **Private**:
        *   If Viewer = Owner OR Viewer = Follower: Returns all posts.
        *   Otherwise: Returns `{ posts: [], isPrivate: true }`.
*   **Post Details**: `GET /api/posts/detail/:postId` explicitly checks privacy. If you try to access a direct link to a private post without following the author, you receive a `403 Forbidden` error.

## 4. Discovery & Feed Protection
To prevent privacy leaks in public feeds:

*   **Explore Feed**: Private users' posts are filtered out of the global Explore/Reels pool unless the viewer already follows them.
*   **Main Feed**: The feed engine checks the `isPrivate` status of authors during the candidate selection phase.
*   **Search**: Users can be found via search, but their profiles will show the "This account is private" state if not followed.

## 5. Summary of API Protections

| Feature | API Endpoint | Privacy Logic |
| :--- | :--- | :--- |
| **Profile Data** | `/api/auth/user/:id` | Masks follower/following lists if private & not following. |
| **Post List** | `/api/posts/user/:id` | Returns empty array + `isPrivate: true` if restricted. |
| **Comments** | `/api/posts/comments` | Returns `403` if post belongs to a private user not followed. |
| **Follow** | `/api/auth/follow` | Routes to `followRequests` if target is private. |
| **Discovery** | `/api/posts/explore-reels` | Excludes private users from public candidate pool. |

---
*Note: These protections are enforced at the Controller level in the backend, ensuring that even if a user manually calls the API, they cannot bypass the follower requirement.*
