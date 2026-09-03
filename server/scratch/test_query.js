const mongoose = require('mongoose');
const Post = require('../models/Post');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/socialsquare';

async function main() {
    await mongoose.connect(MONGO_URI);
    const userId = "67762436cae23569711a1841";
    const ownerObjectId = new mongoose.Types.ObjectId(userId);

    const query = {
        $or: [
            { 'user._id': ownerObjectId },
            {
                collaborators: {
                    $elemMatch: {
                        userId: ownerObjectId,
                        status: 'accepted'
                    }
                }
            }
        ],
        isVisible: { $ne: false },
        deletedAt: null
    };

    const count = await Post.countDocuments(query);
    console.log('Count matching query:', count);

    const posts = await Post.find(query).sort({ createdAt: -1 }).limit(10).lean();
    console.log('Latest 10 posts:');
    posts.forEach(p => {
        console.log(`- ID: ${p._id}, Caption: "${p.caption}", isAnonymous: ${p.isAnonymous}, deletedAt: ${p.deletedAt}, isVisible: ${p.isVisible}`);
    });

    await mongoose.disconnect();
}
main();
