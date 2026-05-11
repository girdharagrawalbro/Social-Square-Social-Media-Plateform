# Data Deletion & Consistency Flow

This document outlines the technical implementation of user and post deletions within the Social Square platform, focusing on maintaining cross-service consistency and data integrity.

## 1. User Deletion (Administrative & Self-Service)

To ensure system integrity and prevent broken references in notifications or social graphs, user deletion follows a **Soft-Delete with Propagation** model.

### 1.1 The Soft-Delete Implementation
When a user is deleted, their record is NOT removed from the database. Instead:
- `deletedAt` field is set to the current timestamp in the `User` model.
- This prevents "orphaned" IDs in notifications or older activity logs from causing server crashes or null-reference errors.

### 1.2 Cascade Cleanup (Propagation)
A dedicated utility, `propagateUserDeletion`, is triggered immediately after the soft-delete. It performs the following **atomic updates** across all other users in the platform:
- **Following/Followers**: Removes the deleted user's ID from all `following` and `followers` arrays.
- **Social Counters**: Atomically decrements `followingCount` and `followersCount` for all affected users using `$inc: -1`.
- **Relationship Lists**: Removes the user from `blockedUsers`, `mutedUsers`, and `dismissedUsers`.
- **Follow Requests**: Removes any pending requests from or to the deleted user.

### 1.3 Post & Report Cleanup
- All posts authored by the user are **soft-deleted** (see Section 2).
- Any reports filed by the deleted user are removed to keep the admin dashboard clean.

---

## 2. Post Deletion & Media Policy

Post deletion ensures that content is immediately hidden from users while preserving data for administrative review and maintaining a **unidirectional media flow**.

### 2.1 Soft-Delete Implementation
- Posts are NOT hard-deleted. Instead, a `deletedAt` timestamp is set.
- All primary content queries (Feed, Explore, Confessions, Mood-Feed) are updated to include `{ deletedAt: null }`.
- Direct access to a soft-deleted post (via ID) results in a `404 Not Found` response, enforced by the `checkPostPrivacy` middleware.

### 2.2 User Metrics
- The `postsCount` for the author is atomically decremented upon soft-deletion.
- **Consistency**: The administrative `delete_post` route correctly synchronizes this count.

### 2.3 Unidirectional Media Flow (Cloudinary)
- **Policy**: The platform does NOT delete media from Cloudinary upon post or user deletion.
- **Rationale**: Media uploads are treated as immutable records within the Cloudinary storage layer. Users can upload content, but the system does not trigger deletions or updates to external assets, ensuring auditability and preventing accidental loss of referenced media.

---

## 3. Consistency Safeguards

### 3.1 Notification Router Guard
The notification system includes a null-guard that checks for the existence of the recipient and sender. If a notification points to a soft-deleted user, it is gracefully skipped or ignored.

### 3.2 Global Query Filtering
All critical discovery routes (Feed, Recommendation, AI Mood-Feed) are hardened with `deletedAt: null` filters. This ensures that even if a record exists in the DB, it is invisible to all platform users immediately after the deletion action.

---

## 4. Maintenance & Jobs
- **Background Cleanup**: Social graph propagation runs as a background task to ensure administrative routes remain responsive.
- **Expiry Logic**: Stale follow requests (over 30 days old) are periodically pruned to maintain database performance.
