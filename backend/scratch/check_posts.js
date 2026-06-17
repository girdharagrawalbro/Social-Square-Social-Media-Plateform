const mongoose = require('mongoose');
const Post = require('../models/Post');
const MONGO_URI = "mongodb+srv://girdharagrawalbro:7909905038@cluster0.czsb19m.mongodb.net/socialsquare?retryWrites=true&w=majority&appName=Cluster0";

async function main() {
    await mongoose.connect(MONGO_URI);
    const postsWithSummary = await Post.find({ aiSummary: { $ne: null } }).limit(5).lean();
    console.log(`Posts with aiSummary: ${postsWithSummary.length}`);
    postsWithSummary.forEach(p => {
        console.log(`- Post ID: ${p._id}, Caption: "${p.caption}", Summary: "${p.aiSummary}"`);
    });

    const totalPosts = await Post.countDocuments();
    const processedPosts = await Post.countDocuments({ aiSummary: { $ne: null } });
    console.log(`Progress: ${processedPosts} / ${totalPosts} posts have aiSummary.`);
    await mongoose.disconnect();
}
main();
