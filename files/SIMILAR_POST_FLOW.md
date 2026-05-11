# Similar Posts Flow & Privacy Guardrails

This document details the technical flow for the "Similar Posts" feature, including the security measures implemented to protect user privacy.

## 1. Technical Flow Overview

The "Similar Posts" feature uses vector-based similarity (AI-driven) to find related content when a user views a post.

### A. Request & Vector Retrieval
*   **API**: `GET /api/recommendation/similar/:postId`
*   **Context**: The route is protected by `verifyToken`, ensuring the viewer's identity (`req.userId`) is known for privacy checks.
*   **Action**: The system looks up the `PostVector` for the current post ID. This vector represents the AI's understanding of the post's content (category, tags, visual features).

### B. Candidate Generation (The Logic)
There are two paths depending on AI model availability:

1.  **Path 1: Vector Similarity (AI Path)**
    *   Fetches the top 200 most recent posts that pass the **Privacy Filter**.
    *   Calculates **Cosine Similarity** between the target post vector and candidate vectors.
    *   Ranks them by score and returns the top 15.

2.  **Path 2: Category/Tag Fallback (Classic Path)**
    *   Used if the target post hasn't been vectorized yet.
    *   Performs a keyword-based search on `category` and `tags`, strictly applying the **Privacy Filter**.

## 2. Security Measures (Privacy Guardrails) ✅

The flow incorporates several layers of protection to ensure private and sensitive content is never leaked.

### A. Following-Aware Exclusion
The system identifies private users that the viewer does **not** follow. Posts from these users are explicitly excluded from the candidate pool. This ensures that:
*   A user **can** see similar posts from people they follow (even if those accounts are private).
*   A user **cannot** discover posts from private accounts they do not follow.

### B. Anonymous Post Exclusion
Anonymous posts (Confessions) are strictly excluded from the "Similar Posts" suggestions. This prevents anonymized content from being linked to public content through discovery feeds, preserving the author's privacy.

### C. Unified Filtering
The privacy filter is applied at the database query level for **both** the AI path and the fallback path, closing the previous gap where unvectorized private posts could leak into recommendations.

## 3. Candidate Filter Logic (Pseudo-code)

```javascript
const privacyFilter = {
    _id: { $ne: targetPostId },
    "user._id": { $nin: restrictedUserIds }, // Private users NOT followed by viewer
    isAnonymous: { $ne: true }               // Never show confessions in similar posts
};
```

## 4. Feature Summary Table

| Step | Operation | Data Source |
| :--- | :--- | :--- |
| **Input** | Target Post ID | Request Params |
| **Context** | Viewer Identity | JWT Token (`req.userId`) |
| **Logic** | Vector Comparison | `PostVector` Collection |
| **Filter** | Privacy Guard | Following-aware exclusion + No Anonymous |
| **Output** | 15 Sorted Posts | JSON Response |

---
*Status: Verified. All discovery paths now respect user privacy settings and relationship status.*
