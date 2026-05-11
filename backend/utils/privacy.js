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

/**
 * Checks if a requester can view a specific post based on privacy rules.
 * @param {Object} post - The post document
 * @param {String} requesterId - The ID of the user trying to view
 * @returns {Boolean}
 */
const canViewPost = async (post, requesterId) => {
    if (!post || post.deletedAt) return false;

    // 1. Requester is the owner?
    const mongoose = require('mongoose');
    const postUserId = post.user?._id || post.user;

    let isOwner = false;
    if (requesterId) {
        const reqIdObj = new mongoose.Types.ObjectId(requesterId);
        if (postUserId && reqIdObj.equals(postUserId)) {
            isOwner = true;
        } else if (post.isAnonymous && post.ownerToken === getOwnerToken(requesterId)) {
            isOwner = true;
        }
    }

    if (isOwner) return true;

    // 2. Anonymous posts are confessions and are considered public in the feed context
    if (post.isAnonymous) return true;

    // 3. Check owner's privacy settings
    const User = require('../models/User');
    const owner = await User.findById(postUserId).select('isPrivate followers').lean();
    if (!owner) return false;

    // Public accounts are visible to everyone
    if (!owner.isPrivate) return true;

    // 4. Private account: Only followers can view
    const isFollower = requesterId && owner.followers?.some(f => {
        try {
            return new mongoose.Types.ObjectId(requesterId).equals(f);
        } catch {
            return false;
        }
    });
    return !!isFollower;
};

/**
 * Middleware to enforce post privacy. 
 * Place this before any route that serves specific post details or content.
 * Should be preceded by verifyToken or softVerifyToken to resolve req.userId.
 */
const checkPostPrivacy = async (req, res, next) => {
    try {
        const Post = require('../models/Post');

        // 1. Fetch post with ownerToken for ownership check
        const post = await Post.findById(req.params.postId).select('+ownerToken');
        if (!post || post.deletedAt) return res.status(404).json({ message: "Post not found." });

        // 2. Run privacy check (req.userId should be resolved by preceding middleware)
        const authorized = await canViewPost(post, req.userId);
        if (!authorized) {
            return res.status(403).json({
                message: "This content is private. Follow the user to view.",
                isPrivate: true,
                ownerId: post.user?._id || post.user
            });
        }

        req.post = post; // Attach to request to save a DB query in the next handler
        next();
    } catch (err) {
        console.error('[Privacy Middleware Error]', err);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {
    getOwnerToken,
    sanitizePost,
    canViewPost,
    checkPostPrivacy
};
