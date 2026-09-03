const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVisiblePostQuery, buildVisibleCommentQuery, getBannedUserIdSet, sortStoryGroupsByRelationship } = require('../utils/contentFilters');

test('buildVisiblePostQuery excludes banned authors and deleted content', () => {
    const bannedIds = ['507f1f77bcf86cd799439011'];
    const query = buildVisiblePostQuery({ category: 'travel' }, bannedIds);

    assert.deepEqual(query.deletedAt, null);
    assert.deepEqual(query.isVisible, { $ne: false });
    assert.deepEqual(query['user._id'], { $nin: bannedIds.map(id => id) });
    assert.equal(query.category, 'travel');
});

test('getBannedUserIdSet resolves banned authors to a Set', () => {
    const ids = getBannedUserIdSet(['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'], ['507f1f77bcf86cd799439012']);
    assert.ok(ids.has('507f1f77bcf86cd799439011'));
    assert.ok(ids.has('507f1f77bcf86cd799439012'));
    assert.equal(ids.size, 2);
});

test('buildVisibleCommentQuery excludes banned authors and orders by reactions before AI metadata', () => {
    const query = buildVisibleCommentQuery({ postId: '507f1f77bcf86cd799439015' }, ['507f1f77bcf86cd799439011']);

    assert.deepEqual(query.postId, '507f1f77bcf86cd799439015');
    assert.deepEqual(query.isVisible, { $ne: false });
    assert.deepEqual(query['user._id'], { $nin: ['507f1f77bcf86cd799439011'] });
    assert.equal(query.sortBy, 'reaction');
});

test('sortStoryGroupsByRelationship prioritizes close friends and unviewed stories first', () => {
    const viewerId = '60f0a1d8d9c2c70001abcd01';
    const viewerProfile = {
        closeFriends: ['60f0a1d8d9c2c70001abcdef'],
        following: ['60f0a1d8d9c2c70001abce00'],
        followers: []
    };

    const groups = [
        { user: { _id: '60f0a1d8d9c2c70001abce00' }, hasUnviewed: false, stories: [{ createdAt: '2024-01-01T00:00:00.000Z' }] },
        { user: { _id: '60f0a1d8d9c2c70001abcdef' }, hasUnviewed: true, stories: [{ createdAt: '2024-01-02T00:00:00.000Z' }] },
        { user: { _id: '60f0a1d8d9c2c70001abce99' }, hasUnviewed: true, stories: [{ createdAt: '2024-01-03T00:00:00.000Z' }] }
    ];

    const ranked = sortStoryGroupsByRelationship(groups, viewerId, viewerProfile);
    assert.equal(ranked[0].user._id, '60f0a1d8d9c2c70001abcdef');
    assert.equal(ranked[1].user._id, '60f0a1d8d9c2c70001abce00');
    assert.equal(ranked[2].user._id, '60f0a1d8d9c2c70001abce99');
});