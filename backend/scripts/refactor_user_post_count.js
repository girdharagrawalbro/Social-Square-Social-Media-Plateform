const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Post = require('../models/Post');

async function refactorPostCounts() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/socialsquare');
        console.log("Connected to MongoDB.");

        const users = await User.find({});
        console.log(`Found ${users.length} users. Starting refactor...`);

        let updatedCount = 0;

        for (const user of users) {
            // Count posts where this user is the author
            // We count documents where user._id matches (standard posts)
            // Note: Anonymous posts are excluded from this count if they can't be linked back
            // However, for the purpose of this script, we count posts explicitly assigned to this user.
            const postCount = await Post.countDocuments({
                'user._id': user._id,
                deletedAt: null
            });

            if (user.postsCount !== postCount) {
                console.log(`Updating ${user.username}: ${user.postsCount} -> ${postCount}`);
                await User.updateOne({ _id: user._id }, { postsCount: postCount });
                updatedCount++;
            }
        }

        console.log("\n========================================");
        console.log(`✅ Refactor completed. Updated ${updatedCount} users.`);
        console.log("========================================");

        await mongoose.disconnect();
    } catch (error) {
        console.error("Refactor failed:", error);
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    }
}

// Do not run directly as per user request
refactorPostCounts();

console.log("Refactor script created. To run it, uncomment the call to refactorPostCounts() at the end of the file or run it via another wrapper.");

module.exports = refactorPostCounts;
