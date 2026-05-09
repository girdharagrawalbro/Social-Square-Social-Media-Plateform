require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');

async function migrateCounts() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        console.log('Fetching all users...');
        const users = await User.find({}).select('_id followers following postsCount followersCount followingCount');
        console.log(`Found ${users.length} users. Migrating counts...`);

        let updated = 0;

        for (const user of users) {
            const followersCount = Array.isArray(user.followers) ? user.followers.length : 0;
            const followingCount = Array.isArray(user.following) ? user.following.length : 0;
            const postsCount = await Post.countDocuments({ 'user._id': user._id });

            await User.updateOne(
                { _id: user._id },
                { $set: { followersCount, followingCount, postsCount } }
            );

            updated++;
            if (updated % 100 === 0) {
                console.log(`Updated ${updated}/${users.length} users...`);
            }
        }

        console.log(`Migration complete. Successfully updated ${updated} users.`);
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        mongoose.connection.close();
        console.log('Disconnected from MongoDB.');
        process.exit(0);
    }
}

migrateCounts();
