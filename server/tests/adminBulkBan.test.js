const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('admin route file imports the mailer at module scope so bulk-ban and admin delete actions do not throw 500s', () => {
    const adminRouteText = fs.readFileSync(path.join(__dirname, '../routes/admin.js'), 'utf8');
    const sendEmailImportIndex = adminRouteText.indexOf("const { sendEmail } = require('../utils/mailer');");
    const firstRouteIndex = adminRouteText.indexOf("router.get('/users'");

    assert.ok(sendEmailImportIndex > -1, 'sendEmail must be imported from the mailer module.');
    assert.ok(firstRouteIndex > -1, 'admin user route should be present.');
    assert.ok(sendEmailImportIndex < firstRouteIndex, 'sendEmail must be imported before the first admin route is defined.');
});
