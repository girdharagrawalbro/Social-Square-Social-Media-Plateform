const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
    path: path.join(__dirname, '../.env')
});

const { runAutoPostJob } = require('../queues/autoPostQueue');

async function test() {
    try {
        console.log('⚡ Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log(' MongoDB Connected.');

        console.log('🤖 Triggering AI Auto-Post Job (forced=true)...');
        const post = await runAutoPostJob(true);

        if (post) {
            console.log('🎉 Test Succeeded!');
            console.log('Post Details:', {
                id: post._id,
                category: post.category,
                mood: post.mood,
                image_url: post.image_urls?.[0],
                caption: post.caption
            });
        } else {
            console.log('⚠️ Job returned null (it might have been skipped).');
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('🔥 Test Failed:', err);
        try {
            await mongoose.disconnect();
        } catch { }
        process.exit(1);
    }
}

test();
