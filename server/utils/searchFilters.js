function buildUserSearchQuery(rawQuery, normalizedQuery) {
    const escapedQuery = rawQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchName = normalizedQuery || escapedQuery;

    return {
        isBanned: { $ne: true },
        deletedAt: null,
        $or: [
            { fullname: { $regex: escapedQuery, $options: 'i' } },
            { username: { $regex: searchName, $options: 'i' } }
        ]
    };
}

module.exports = { buildUserSearchQuery };
