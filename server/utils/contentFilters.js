function getBannedUserIdSet(...sources) {
    const ids = new Set();

    for (const source of sources) {
        if (!source) continue;

        if (Array.isArray(source)) {
            for (const value of source) {
                if (!value) continue;
                ids.add(String(value).trim());
            }
            continue;
        }

        if (typeof source === 'object') {
            if (source._id) ids.add(String(source._id));
            if (source.user && source.user._id) ids.add(String(source.user._id));
            continue;
        }

        ids.add(String(source).trim());
    }

    return ids;
}

function buildVisiblePostQuery(baseQuery = {}, bannedUserIds = [], options = {}) {
    const { excludeAnonymous = true } = options;
    const bannedIds = Array.from(getBannedUserIdSet(bannedUserIds)).filter(Boolean);

    const query = {
        ...baseQuery,
        deletedAt: null,
        isVisible: { $ne: false }
    };

    if (excludeAnonymous) {
        query.isAnonymous = { $ne: true };
    }

    if (bannedIds.length > 0) {
        query['user._id'] = { $nin: bannedIds };
    }

    return query;
}

function buildVisibleCommentQuery(baseQuery = {}, bannedUserIds = []) {
    const bannedIds = Array.from(getBannedUserIdSet(bannedUserIds)).filter(Boolean);
    const query = {
        ...baseQuery,
        isVisible: { $ne: false },
        sortBy: 'reaction'
    };

    if (bannedIds.length > 0) {
        query['user._id'] = { $nin: bannedIds };
    }

    return query;
}

function sortCommentsByReaction(comments = []) {
    return [...comments].sort((a, b) => {
        const aScore = (a.likes?.length || 0) + (a.replies?.length || 0) * 2 + (a.isBestAnswer ? 5 : 0) + (a.isInsightful ? 3 : 0);
        const bScore = (b.likes?.length || 0) + (b.replies?.length || 0) * 2 + (b.isBestAnswer ? 5 : 0) + (b.isInsightful ? 3 : 0);

        if (bScore !== aScore) return bScore - aScore;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
}

function getStoryFeedRankScore(group = {}, viewerId = '', viewerProfile = {}) {
    const ownerId = String(group?.user?._id || group?.userId || '');
    const relationshipScore = (() => {
        if (!viewerId || !ownerId) return 0;
        if (viewerId === ownerId) return 1000;

        const isCloseFriend = (viewerProfile.closeFriends || []).some(id => String(id) === ownerId);
        const isFollowing = (viewerProfile.following || []).some(id => String(id) === ownerId);
        const isFollower = (viewerProfile.followers || []).some(id => String(id) === ownerId);

        if (isCloseFriend) return 900;
        if (isFollowing) return 700;
        if (isFollower) return 500;
        return 0;
    })();

    const latestStoryTime = (group?.stories || []).reduce((latest, story) => {
        const storyTime = story?.createdAt ? new Date(story.createdAt).getTime() : 0;
        return Math.max(latest, storyTime);
    }, 0);

    const recencyBoost = latestStoryTime ? Math.min(200, Math.max(0, (Date.now() - latestStoryTime) / (1000 * 60 * 60 * 3))) : 0;
    const unviewedBoost = group?.hasUnviewed ? 150 : 0;

    return relationshipScore + unviewedBoost + recencyBoost;
}

function sortStoryGroupsByRelationship(storyGroups = [], viewerId = '', viewerProfile = {}) {
    return [...storyGroups].sort((a, b) => {
        const scoreA = getStoryFeedRankScore(a, viewerId, viewerProfile);
        const scoreB = getStoryFeedRankScore(b, viewerId, viewerProfile);

        if (scoreB !== scoreA) return scoreB - scoreA;
        if ((b?.hasUnviewed || false) !== (a?.hasUnviewed || false)) return Number(b?.hasUnviewed) - Number(a?.hasUnviewed);

        const latestA = (a?.stories || []).reduce((max, story) => Math.max(max, story?.createdAt ? new Date(story.createdAt).getTime() : 0), 0);
        const latestB = (b?.stories || []).reduce((max, story) => Math.max(max, story?.createdAt ? new Date(story.createdAt).getTime() : 0), 0);
        return latestB - latestA;
    });
}

module.exports = {
    getBannedUserIdSet,
    buildVisiblePostQuery,
    buildVisibleCommentQuery,
    sortCommentsByReaction,
    getStoryFeedRankScore,
    sortStoryGroupsByRelationship
};
