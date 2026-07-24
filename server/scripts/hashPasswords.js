/**
 * Run this script to hash plaintext passwords for all users:
 *   node scripts/hashPasswords.js
 */

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const isBcrypt = (str) => {
    return typeof str === 'string' && str.startsWith('$2') && str.length === 60;
};

async function run() {
    const MONGO_URI = "mongodb+srv://girdharagrawalbro:7909905038@cluster0.czsb19m.mongodb.net/socialsquare?retryWrites=true&w=majority&appName=Cluster0"
    // const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) {
        console.error('MONGO_URI is missing in your environment variables.');
        process.exit(1);
    }

    console.log('Connecting to database...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to database.');

    const users = await User.find({ password: { $exists: true, $ne: null } });
    console.log(`Found ${users.length} users with password fields.`);

    let updateCount = 0;

    for (const user of users) {
        if (!user.password) continue;

        if (!isBcrypt(user.password)) {
            console.log(`Hashing password for user: ${user.fullname} (${user.email || user.username})`);
            const hashedPassword = await bcrypt.hash(user.password, 12);
            user.password = hashedPassword;
            await user.save();
            updateCount++;
        }
    }

    console.log(` Finished. Updated/hashed passwords for ${updateCount} user(s).`);
    process.exit(0);
}

run().catch(err => {
    console.error('Error running script:', err);
    process.exit(1);
});
