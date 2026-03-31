const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('MONGO_URI not found in environment');
    process.exit(1);
}

async function populateUsernames() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const users = await User.find({ username: { $exists: false } });
        console.log(`Found ${users.length} users with missing usernames`);

        for (const user of users) {
            let base = user.fullname.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
            if (!base) base = 'user';
            
            let username = base;
            let exists = await User.findOne({ username, _id: { $ne: user._id } });
            let counter = 1;

            while (exists) {
                username = `${base}${counter}`;
                exists = await User.findOne({ username, _id: { $ne: user._id } });
                counter++;
            }

            user.username = username;
            await user.save();
            console.log(`Updated user ${user.fullname} -> @${username}`);
        }

        console.log('Finished updating usernames');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

populateUsernames();
