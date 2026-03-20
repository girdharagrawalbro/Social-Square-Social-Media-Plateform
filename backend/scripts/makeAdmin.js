/**
 * Run this script to grant admin access to a user:
 *   node scripts/makeAdmin.js your@email.com
 */

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const User = require('../models/User');

const email = process.argv[2];

if (!email) {
    console.error('Usage: node scripts/makeAdmin.js <email>');
    process.exit(1);
}

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOne({ email });
    if (!user) { console.error(`No user found with email: ${email}`); process.exit(1); }
    user.isAdmin = true;
    await user.save();
    console.log(`✅ ${user.fullname} (${user.email}) is now an admin.`);
    process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });