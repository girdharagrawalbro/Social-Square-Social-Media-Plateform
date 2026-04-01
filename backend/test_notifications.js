const mongoose = require('mongoose');
const User = require('./models/User');
const Notification = require('./models/Notification');
const { createNotification, setIo } = require('./lib/notification');
require('dotenv').config();

async function testInAppNotifications() {
    try {
        const uri = process.env.MONGO_URI;
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        const sender = await User.findOne();
        const recipient = await User.findOne({ _id: { $ne: sender._id } });

        if (!sender || !recipient) {
            console.error('Need at least 2 users to test notifications');
            process.exit(1);
        }

        console.log(`Sender: ${sender.fullname}, Recipient: ${recipient.fullname}`);

        // Mock Socket.io
        setIo({
            to: (id) => ({
                emit: (event, data) => {
                    console.log(`[Socket Mock] Emitted '${event}' to room '${id}'`);
                }
            })
        });

        const notification = await createNotification({
            recipientId: recipient._id,
            sender: {
                id: sender._id,
                fullname: sender.fullname,
                profile_picture: sender.profile_picture
            },
            type: 'like',
            postId: new mongoose.Types.ObjectId(), // mock post id
        });

        if (notification) {
            console.log('Notification created successfully in DB:', notification._id);
            console.log('Type:', notification.type);
        } else {
            console.error('Failed to create notification');
        }

        process.exit(0);
    } catch (err) {
        console.error('Test failed:', err);
        process.exit(1);
    }
}

testInAppNotifications();
