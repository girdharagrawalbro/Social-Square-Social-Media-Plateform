const mongoose = require('mongoose');
const User = require('../models/User');

function normalizeId(value) {
    if (!value) return null;
    if (value instanceof mongoose.Types.ObjectId) return value.toString();
    if (typeof value === 'string') return value;
    if (value && value.toString) return value.toString();
    return null;
}

function toSet(values = []) {
    return new Set((Array.isArray(values) ? values : []).map(normalizeId).filter(Boolean));
}

function buildRelationshipContext(viewer, target) {
    if (!viewer || !target) {
        return {
            isFollowing: false,
            isFollowedBy: false,
            isBlocked: false,
            isMuted: false,
            isCloseFriend: false,
            isRestricted: false,
            mutualFollowCount: 0,
            interactionScore: 0,
        };
    }

    const viewerId = normalizeId(viewer._id || viewer.id);
    const targetId = normalizeId(target._id || target.id);

    const viewerFollowing = toSet(viewer.following);
    const viewerBlocked = toSet(viewer.blockedUsers);
    const viewerMuted = toSet(viewer.mutedUsers);
    const viewerCloseFriends = toSet(viewer.closeFriends);

    const targetFollowers = toSet(target.followers);
    const targetFollowing = toSet(target.following);
    const targetBlocked = toSet(target.blockedUsers);
    const targetCloseFriends = toSet(target.closeFriends);

    const isFollowing = viewerId && viewerFollowing.has(targetId);
    const isFollowedBy = viewerId && targetFollowers.has(viewerId);
    const isBlocked = !!(viewerId && (viewerBlocked.has(targetId) || targetBlocked.has(viewerId)));
    const isMuted = !!(viewerId && (viewerMuted.has(targetId)));
    const isCloseFriend = !!(viewerId && viewerCloseFriends.has(targetId));

    const mutualSet = new Set([...viewerFollowing].filter(id => targetFollowing.has(id)));
    const mutualFollowCount = mutualSet.size;

    const interactionScore = (
        (isFollowing ? 25 : 0) +
        (isFollowedBy ? 20 : 0) +
        (isCloseFriend ? 30 : 0) +
        (mutualFollowCount * 10) +
        (isBlocked ? -100 : 0) +
        (isMuted ? -30 : 0)
    );

    const isRestricted = !!(
        viewerId && (
            isBlocked ||
            viewerMuted.has(targetId) ||
            targetBlocked.has(viewerId) ||
            (target && target.isPrivate && !isFollowing && !isFollowedBy)
        )
    );

    return {
        isFollowing,
        isFollowedBy,
        isBlocked,
        isMuted,
        isCloseFriend,
        isRestricted,
        mutualFollowCount,
        interactionScore,
        viewerId,
        targetId,
    };
}

async function getRelationshipContext(viewerId, targetId) {
    if (!viewerId || !targetId) return buildRelationshipContext(null, null);

    const [viewer, target] = await Promise.all([
        User.findById(viewerId).select('following blockedUsers mutedUsers closeFriends').lean(),
        User.findById(targetId).select('followers following blockedUsers closeFriends isPrivate').lean(),
    ]);

    return buildRelationshipContext(viewer || {}, target || {});
}

async function getRelationshipsBatch(viewerId, targetIds = []) {
    if (!viewerId || !Array.isArray(targetIds) || targetIds.length === 0) return {};

    const uniqueIds = [...new Set(targetIds.map(normalizeId).filter(Boolean))];
    const [viewer, targets] = await Promise.all([
        User.findById(viewerId).select('following blockedUsers mutedUsers closeFriends').lean(),
        User.find({ _id: { $in: uniqueIds } }).select('followers following blockedUsers closeFriends isPrivate').lean(),
    ]);

    const targetMap = new Map();
    for (const user of targets) {
        targetMap.set(normalizeId(user._id), user);
    }

    const result = {};
    for (const targetId of uniqueIds) {
        const target = targetMap.get(targetId) || {};
        result[targetId] = buildRelationshipContext(viewer || {}, target);
    }
    return result;
}

module.exports = {
    buildRelationshipContext,
    getRelationshipContext,
    getRelationshipsBatch,
    relationshipService: {
        buildRelationshipContext,
        getRelationshipContext,
        getRelationshipsBatch,
    },
};
