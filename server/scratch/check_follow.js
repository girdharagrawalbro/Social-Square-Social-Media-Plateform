const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/socialsquare');

        const muskan = await User.findOne({ fullname: /Muskan/i });
        const targetUser = await User.findOne({ fullname: /Target/i });

        if (!muskan || !targetUser) {
            console.log("Users not found");
            process.exit();
        }

        console.log("Muskan ID:", muskan._id);
        console.log("Target Following:", targetUser.following);
        console.log("Is target user following Muskan?", targetUser.following.includes(muskan._id));

        const followingStrings = targetUser.following.map(id => id.toString());
        console.log("Is Muskan ID (string) in target following (strings)?", followingStrings.includes(muskan._id.toString()));

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

check();
