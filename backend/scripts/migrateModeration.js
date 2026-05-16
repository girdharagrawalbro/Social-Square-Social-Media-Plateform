const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Post = require('../models/Post');
const Comment = require('../models/Comment');

dotenv.config();

/**
 * Migration script to initialize moderation fields for legacy content.
 * Sets isVisible: true and isFlagged: false for all documents missing these fields.
 */
async function migrate() {
    if (!process.env.MONGO_URI) {
        console.error('❌ MONGO_URI not found in environment');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('📦 Connected to MongoDB');

        console.log('🔄 Migrating Posts (setting isVisible: true for legacy posts)...');
        const postResult = await Post.updateMany(
            { isVisible: { $exists: false } },
            { $set: { isVisible: true, isFlagged: false } }
        );
        console.log(`✅ Posts updated: ${postResult.modifiedCount}`);

        console.log('🔄 Migrating Comments (setting isVisible: true for legacy comments)...');
        const commentResult = await Comment.updateMany(
            { isVisible: { $exists: false } },
            { $set: { isVisible: true, isFlagged: false } }
        );
        console.log(`✅ Comments updated: ${commentResult.modifiedCount}`);

        console.log('🎉 Moderation field migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('🔥 Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
