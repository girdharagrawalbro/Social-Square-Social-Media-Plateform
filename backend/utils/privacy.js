const crypto = require('crypto');

const HMAC_SECRETS = {
    1: { secret: process.env.PRIVACY_HMAC_SECRET || process.env.JWT_SECRET || 'fallback_secret' },
    // 2: { secret: process.env.PRIVACY_HMAC_SECRET_OLD, retiredAt: new Date('2026-08-01') }
};

/**
 * Generates a one-way HMAC of a user ID to be used as an ownership token for anonymous posts.
 * This always signs with the latest (version 1) secret.
 */
function getOwnerToken(userId, version = 1) {
    if (!userId) return null;
    const config = HMAC_SECRETS[version];
    if (!config || !config.secret) return null;
    return crypto.createHmac('sha256', config.secret)
        .update(userId.toString())
        .digest('hex');
}

/**
 * Verifies if a given user ID matches the stored ownerToken by testing against all active secret versions.
 * Uses crypto.timingSafeEqual to prevent timing attacks.
 */
function verifyOwnerToken(userId, storedToken) {
    if (!userId || !storedToken) return false;

    for (const version of Object.keys(HMAC_SECRETS)) {
        const config = HMAC_SECRETS[version];

        // Skip retired secrets to prevent forever-valid V2 hashes
        if (config.retiredAt && Date.now() > config.retiredAt.getTime()) {
            continue;
        }

        const generatedHash = getOwnerToken(userId, version);
        if (!generatedHash) continue;

        try {
            const generatedBuffer = Buffer.from(generatedHash, 'hex');
            const storedBuffer = Buffer.from(storedToken, 'hex');

            if (generatedBuffer.length === storedBuffer.length &&
                crypto.timingSafeEqual(generatedBuffer, storedBuffer)) {
                return true;
            }
        } catch (e) {
            // Buffer.from can throw if storedToken is malformed (not valid hex)
            continue;
        }
    }
    return false;
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
function sanitizeAnonymousPost(post, viewerId = null) {
    if (!post) return post;

    const viewerIdStr = viewerId ? viewerId.toString() : null;

    // Check ownership
    let isOwner = false;
    const postUserIdStr = post.user?._id?.toString() || post.user?.toString();

    if (viewerIdStr) {
        if (postUserIdStr === viewerIdStr) {
            isOwner = true;
        } else if (post.ownerToken && verifyOwnerToken(viewerIdStr, post.ownerToken)) {
            // Even if user._id is masked in DB, we can verify ownership via HMAC token
            isOwner = true;
        }
    }

    // Apply anonymity rules
    if (post.isAnonymous) {
        delete post.location;
        if (!isOwner) {
            if (post.user && typeof post.user === 'object') {
                post.user._id = "anonymous";
                post.user.fullname = "Anonymous User";
                post.user.profile_picture = "https://res.cloudinary.com/dcmrsdydh/image/upload/v1778490037/logo_eyc3at.jpg";
            } else {
                post.user = "anonymous";
            }
            post.collaborators = [];
        }
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
    if (!post || post.deletedAt || post.isVisible === false) return false;

    // 1. Requester is the owner?
    const mongoose = require('mongoose');
    const postUserId = post.user?._id || post.user;

    let isOwner = false;
    if (requesterId) {
        const reqIdObj = new mongoose.Types.ObjectId(requesterId);
        if (postUserId && reqIdObj.equals(postUserId)) {
            isOwner = true;
        } else if (post.isAnonymous && verifyOwnerToken(requesterId, post.ownerToken)) {
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
        if (!post || post.deletedAt || post.isVisible === false) return res.status(404).json({ message: "Post not found." });

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

/**
 * Fetches the list of user IDs that should be excluded from the current user's feeds.
 * This includes:
 * 1. Private users that the current user is NOT following.
 * 2. Users that the current user has blocked or muted.
 * 3. Users who have blocked the current user.
 * Results are cached in Redis for 60 seconds (Risk 2).
 */
const getRestrictedUserIds = async (userId) => {
    if (!userId) return [];
    const redis = require('../lib/redis');
    const User = require('../models/User');
    const cacheKey = `restricted_users:excl:${userId}`;

    try {
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const loggedUser = await User.findById(userId).select('following blockedUsers mutedUsers').lean();
        const followingIds = (loggedUser?.following || []).map(id => id.toString());
        const blockedIds = (loggedUser?.blockedUsers || []).map(id => id.toString());
        const mutedIds = (loggedUser?.mutedUsers || []).map(id => id.toString());

        // Find users who have blocked this user
        const blockers = await User.find({ blockedUsers: userId }).select('_id').lean();
        const blockerIds = blockers.map(b => b._id.toString());

        // Find all private users excluding those the user follows (and themselves)
        const privateUsers = await User.find({
            isPrivate: true,
            _id: { $nin: [...followingIds, userId] }
        }).select('_id').lean();

        const privateUserIds = privateUsers.map(u => u._id.toString());

        const restrictedIds = [...new Set([...privateUserIds, ...blockedIds, ...mutedIds, ...blockerIds])];

        // Cache with TTL (5 minutes) to balance freshness and performance
        await redis.set(cacheKey, JSON.stringify(restrictedIds), 'EX', 300);
        return restrictedIds;
    } catch (err) {
        console.error('[getRestrictedUserIds] Error:', err.message);
        return [];
    }
};

module.exports = {
    getOwnerToken,
    verifyOwnerToken,
    sanitizeAnonymousPost,
    getRestrictedUserIds,
    canViewPost,
    checkPostPrivacy
};
