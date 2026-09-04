const crypto = require('crypto');
const { buildRelationshipContext } = require('../services/relationshipService');
const { USER_DEFAULT_IMAGE } = require('./constantMediaVariable');

// PRIVACY_HMAC_SECRET MUST be set — it is distinct key material from JWT_SECRET.
// Using JWT_SECRET as a fallback would be a security misconfiguration (wrong key purpose).
// A missing secret is caught at startup to prevent silent HMAC failures in production.
if (!process.env.PRIVACY_HMAC_SECRET) {
    if (process.env.NODE_ENV === 'production') {
        // Fatal in production — do not allow anonymous post HMAC to use wrong key material
        throw new Error('[FATAL] PRIVACY_HMAC_SECRET is not set. Cannot start in production without it.');
    }
    // In dev/test — log a clear warning; do not use JWT_SECRET as a silent fallback
    console.warn('[WARNING] PRIVACY_HMAC_SECRET not set. Anonymous post ownership tokens are INSECURE in this environment.');
}

const HMAC_SECRETS = {
    1: { secret: process.env.PRIVACY_HMAC_SECRET },
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
                post.user.profile_picture = USER_DEFAULT_IMAGE;
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

    const mongoose = require('mongoose');
    const User = require('../models/User');
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
    if (post.isAnonymous) return true;

    const [viewer, owner] = await Promise.all([
        requesterId ? User.findById(requesterId).select('following blockedUsers mutedUsers closeFriends').lean() : null,
        User.findById(postUserId).select('isPrivate followers following blockedUsers mutedUsers closeFriends').lean(),
    ]);

    if (!owner) return false;

    const relationship = buildRelationshipContext(viewer || null, owner);
    if (relationship.isBlocked || relationship.isMuted) return false;
    if (!owner.isPrivate) return true;

    return !!relationship.isFollowing || !!relationship.isFollowedBy;
};

/**
 * Middleware to enforce post privacy. 
 * Place this before any route that serves specific post details or content.
 * Should be preceded by verifyToken or softVerifyToken to resolve req.userId.
 */
const checkPostPrivacy = async (req, res, next) => {
    try {
        const Post = require('../models/Post');

        // 1. Fetch post with ownerToken for ownership check and populate mentions/goals
        const post = await Post.findById(req.params.postId).select('+ownerToken').populate('mentions', 'username fullname').populate('goalId', 'title progress');
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
const restrictedUserPromises = new Map();

const getRestrictedUserIds = async (userId) => {
    if (!userId) return [];
    
    // Promise Coalescing: return the existing promise if already fetching for this userId
    if (restrictedUserPromises.has(userId)) {
        return restrictedUserPromises.get(userId);
    }
    
    const promise = (async () => {
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

            // Run independent queries concurrently
            const [blockers, privateUsers] = await Promise.all([
                User.find({ blockedUsers: userId }).select('_id').lean(),
                User.find({
                    isPrivate: true,
                    _id: { $nin: [...followingIds, userId] }
                }).select('_id').lean()
            ]);

            const blockerIds = blockers.map(b => b._id.toString());
            const privateUserIds = privateUsers.map(u => u._id.toString());

            const restrictedIds = [...new Set([...privateUserIds, ...blockedIds, ...mutedIds, ...blockerIds])];

            // Cache with TTL (5 minutes) to balance freshness and performance
            await redis.set(cacheKey, JSON.stringify(restrictedIds), 'EX', 300);
            return restrictedIds;
        } catch (err) {
            console.error('[getRestrictedUserIds] Error:', err.message);
            return [];
        } finally {
            restrictedUserPromises.delete(userId);
        }
    })();
    
    restrictedUserPromises.set(userId, promise);
    return promise;
};

module.exports = {
    getOwnerToken,
    verifyOwnerToken,
    sanitizeAnonymousPost,
    getRestrictedUserIds,
    canViewPost,
    checkPostPrivacy
};
