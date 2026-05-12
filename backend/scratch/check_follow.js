const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/socialsquare');

        const muskan = await User.findOne({ fullname: /Muskan/i });
        const girdhar = await User.findOne({ fullname: /Girdhar/i });

        if (!muskan || !girdhar) {
            console.log("Users not found");
            process.exit();
        }

        console.log("Muskan ID:", muskan._id);
        console.log("Girdhar Following:", girdhar.following);
        console.log("Is Girdhar following Muskan?", girdhar.following.includes(muskan._id));

        const followingStrings = girdhar.following.map(id => id.toString());
        console.log("Is Muskan ID (string) in Girdhar following (strings)?", followingStrings.includes(muskan._id.toString()));

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

check();
