const test = require('node:test');
const assert = require('node:assert/strict');

const { buildUserSearchQuery } = require('../utils/searchFilters');

test('search excludes banned and deleted users', () => {
    const query = buildUserSearchQuery('john', 'john');

    assert.deepEqual(query.isBanned, { $ne: true });
    assert.equal(query.deletedAt, null);
    assert.equal(query.$or.length, 2);
    assert.match(query.$or[0].fullname.$regex, /john/i);
    assert.match(query.$or[1].username.$regex, /john/i);
});
