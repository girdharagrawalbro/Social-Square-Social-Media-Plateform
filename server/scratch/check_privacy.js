const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/socialsquare');

        const muskan = await User.findOne({ fullname: /Muskan/i });
        if (!muskan) {
            console.log("Muskan not found");
            process.exit();
        }

        console.log("User:", muskan.fullname, "ID:", muskan._id, "isPrivate:", muskan.isPrivate);

        const posts = await Post.find({ "user._id": muskan._id });
        console.log("Found", posts.length, "posts for Muskan");

        // Check restricted list for a test user
        const testUser = await User.findOne({ _id: { $ne: muskan._id } });
        if (testUser) {
            const { getRestrictedUserIds } = require("../utils/privacy");
            const restricted = await getRestrictedUserIds(testUser._id);
            console.log("Restricted count for", testUser.fullname, ":", restricted.length);
            const isRestricted = restricted.includes(muskan._id.toString());
            console.log("Is Muskan in restricted list?", isRestricted);

            if (isRestricted) {
                // Try to find posts with the restricted list as strings
                const candidatesStrings = await Post.find({
                    "user._id": { $nin: restricted }
                }).limit(5);
                console.log("Candidates found using string NIN:", candidatesStrings.length);

                // Try with ObjectIds
                const restrictedObjectIds = restricted.map(id => new mongoose.Types.ObjectId(id));
                const candidatesObjects = await Post.find({
                    "user._id": { $nin: restrictedObjectIds }
                }).limit(5);
                console.log("Candidates found using ObjectId NIN:", candidatesObjects.length);
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

check();
