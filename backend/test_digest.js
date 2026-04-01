require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Notification = require('./models/Notification');
const Post = require('./models/Post');
const { digestQueue } = require('./queues/digestQueue');

async function runTest() {
    try {
        console.log('--- ENV CHECK ---');
        console.log('MONGO_URI exists:', !!process.env.MONGO_URI);
        console.log('MAIL_SERVICE_BASE_URL:', process.env.MAIL_SERVICE_BASE_URL);
        
        const uri = process.env.MONGO_URI;
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        let testUser = await User.findOne({ email: 'girdharagrawalbro@gmail.com' });
        if (!testUser) testUser = await User.findOne();
        
        console.log(`Testing with user: ${testUser.email}`);

        await User.findByIdAndUpdate(testUser._id, { 
            'notificationSettings.emailDigest': true,
            isBanned: false,
            isAdmin: true // ensure it sends even if 0 interactions
        });

        console.log('Added manual job to queue...');
        const job = await digestQueue.add('daily-digest', { manual: true });
        console.log(`Job ID: ${job.id}`);

        // The worker is already running because we imported digestQueue
        await new Promise(r => setTimeout(r, 6000));
        
        process.exit(0);
    } catch (err) {
        console.error('Test failed:', err);
        process.exit(1);
    }
}

runTest();
