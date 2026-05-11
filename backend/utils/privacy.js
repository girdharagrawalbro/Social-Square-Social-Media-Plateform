const crypto = require('crypto');

/**
 * Generates a one-way HMAC of a user ID to be used as an ownership token for anonymous posts.
 * This allows the user to claim ownership without storing their real ID in the post document.
 */
function getOwnerToken(userId) {
    if (!userId) return null;
    const secret = process.env.PRIVACY_HMAC_SECRET || process.env.JWT_SECRET || 'fallback_secret';
    return crypto.createHmac('sha256', secret)
        .update(userId.toString())
        .digest('hex');
}

/**
 * Unified sanitization for posts.
 * - For anonymous posts: Masks author identity and clears collaborators.
 * - Can be used in Mongoose toJSON transforms or on plain objects (lean queries).
 * 
 * @param {Object} post - The post object to sanitize.
 * @param {string|ObjectId} viewerId - The ID of the user viewing the post.
 * @returns {Object} The sanitized post.
 */
function sanitizePost(post, viewerId = null) {
    if (!post) return post;

    const viewerIdStr = viewerId ? viewerId.toString() : null;
    
    // Check ownership
    let isOwner = false;
    const postUserIdStr = post.user?._id?.toString() || post.user?.toString();
    
    if (viewerIdStr) {
        if (postUserIdStr === viewerIdStr) {
            isOwner = true;
        } else if (post.ownerToken && post.ownerToken === getOwnerToken(viewerIdStr)) {
            // Even if user._id is masked in DB, we can verify ownership via HMAC token
            isOwner = true;
        }
    }

    // Apply anonymity rules
    if (post.isAnonymous && !isOwner) {
        if (post.user && typeof post.user === 'object') {
            post.user._id = "anonymous";
            post.user.fullname = "Anonymous User";
            post.user.profile_picture = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
        } else {
            post.user = "anonymous";
        }
        post.collaborators = [];
    }

    // Always hide ownerToken from response for security
    if (post.toObject) {
        // Handle Mongoose document if necessary
    }
    
    // Delete sensitive internal fields from the result object
    if (typeof post === 'object') {
        delete post.ownerToken;
    }

    return post;
}

module.exports = { getOwnerToken, sanitizePost };
