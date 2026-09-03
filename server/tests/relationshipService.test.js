const test = require('node:test');
const assert = require('node:assert/strict');

const { buildRelationshipContext } = require('../services/relationshipService');

test('buildRelationshipContext computes follow/block/mute/close-friend relationships', () => {
    const viewer = {
        _id: 'u1',
        following: ['u2', 'u3'],
        blockedUsers: ['u4'],
        mutedUsers: ['u3'],
        closeFriends: ['u2'],
    };

    const target = {
        _id: 'u2',
        followers: ['u1', 'u5'],
        closeFriends: ['u1'],
        following: ['u1', 'u6'],
    };

    const ctx = buildRelationshipContext(viewer, target);

    assert.equal(ctx.isFollowing, true);
    assert.equal(ctx.isFollowedBy, true);
    assert.equal(ctx.isBlocked, false);
    assert.equal(ctx.isMuted, false);
    assert.equal(ctx.isCloseFriend, true);
    assert.equal(ctx.mutualFollowCount, 0);
    assert.equal(ctx.isRestricted, false);
});

test('buildRelationshipContext counts shared friends as mutual follows', () => {
    const viewer = {
        _id: 'u1',
        following: ['u2', 'u3', 'u4'],
        blockedUsers: [],
        mutedUsers: [],
        closeFriends: [],
    };

    const target = {
        _id: 'u5',
        followers: [],
        closeFriends: [],
        following: ['u2', 'u3', 'u6'],
    };

    const ctx = buildRelationshipContext(viewer, target);

    assert.equal(ctx.mutualFollowCount, 2);
});

test('buildRelationshipContext marks reciprocal block as blocked and restricted', () => {
    const viewer = {
        _id: 'u1',
        following: ['u2'],
        blockedUsers: ['u3'],
        mutedUsers: [],
        closeFriends: [],
    };

    const target = {
        _id: 'u2',
        followers: ['u3'],
        closeFriends: [],
        following: ['u3'],
        blockedUsers: ['u1'],
    };

    const ctx = buildRelationshipContext(viewer, target);

    assert.equal(ctx.isBlocked, true);
    assert.equal(ctx.isRestricted, true);
    assert.equal(ctx.mutualFollowCount, 0);
});
