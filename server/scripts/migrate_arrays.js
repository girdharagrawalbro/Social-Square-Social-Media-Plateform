require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const { loadSecrets } = require('../loadSecrets');

// Models
const User = require('../models/User');
const Post = require('../models/Post');
const Follow = require('../models/Follow');
const CloseFriend = require('../models/CloseFriend');
const SavedPost = require('../models/SavedPost');
const AccountHistory = require('../models/AccountHistory');
const Like = require('../models/Like');
const Reaction = require('../models/Reaction');

async function migrateData() {
    await loadSecrets();
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 10 });
    console.log('Connected.');

    console.log('--- Migrating Users ---');
    const userCursor = User.find().cursor();
    let userCount = 0;

    for await (const user of userCursor) {
        userCount++;
        if (userCount % 100 === 0) console.log(`Processed ${userCount} users`);

        const followOps = [];
        if (user.following && user.following.length > 0) {
            for (const followingId of user.following) {
                followOps.push({
                    updateOne: {
                        filter: { followerId: user._id, followingId: followingId },
                        update: { $set: { followerId: user._id, followingId: followingId } },
                        upsert: true
                    }
                });
            }
        }

        if (user.followers && user.followers.length > 0) {
            for (const followerId of user.followers) {
                followOps.push({
                    updateOne: {
                        filter: { followerId: followerId, followingId: user._id },
                        update: { $set: { followerId: followerId, followingId: user._id } },
                        upsert: true
                    }
                });
            }
        }

        if (followOps.length > 0) {
            await Follow.bulkWrite(followOps, { ordered: false }).catch(err => {
                if (err.code !== 11000) console.error(err);
            });
        }

        if (user.closeFriends && user.closeFriends.length > 0) {
            const cfOps = user.closeFriends.map(friendId => ({
                updateOne: {
                    filter: { userId: user._id, friendId: friendId },
                    update: { $set: { userId: user._id, friendId: friendId } },
                    upsert: true
                }
            }));
            await CloseFriend.bulkWrite(cfOps, { ordered: false });
        }

        if (user.savedPosts && user.savedPosts.length > 0) {
            const spOps = user.savedPosts.map(postId => ({
                updateOne: {
                    filter: { userId: user._id, postId: postId },
                    update: { $set: { userId: user._id, postId: postId } },
                    upsert: true
                }
            }));
            await SavedPost.bulkWrite(spOps, { ordered: false });
        }

        if (user.accountHistory && user.accountHistory.length > 0) {
            const ahOps = user.accountHistory.map(history => ({
                insertOne: {
                    document: {
                        userId: user._id,
                        action: history.action,
                        details: history.details,
                        ipAddress: history.ipAddress,
                        createdAt: history.createdAt || new Date()
                    }
                }
            }));
            await AccountHistory.bulkWrite(ahOps, { ordered: false });
        }
    }

    console.log('--- Migrating Posts ---');
    const postCursor = Post.find().cursor();
    let postCount = 0;

    for await (const post of postCursor) {
        postCount++;
        if (postCount % 100 === 0) console.log(`Processed ${postCount} posts`);

        if (post.likes && post.likes.length > 0) {
            const likeOps = post.likes.map(userId => ({
                updateOne: {
                    filter: { postId: post._id, userId: userId },
                    update: { $set: { postId: post._id, userId: userId } },
                    upsert: true
                }
            }));
            await Like.bulkWrite(likeOps, { ordered: false });
        }

        if (post.reactions && post.reactions.length > 0) {
            const reactionOps = post.reactions.map(r => ({
                updateOne: {
                    filter: { postId: post._id, userId: r.userId },
                    update: { $set: { postId: post._id, userId: r.userId, emoji: r.emoji } },
                    upsert: true
                }
            }));
            await Reaction.bulkWrite(reactionOps, { ordered: false });
        }
    }

    console.log('Migration completed successfully.');
    process.exit(0);
}

migrateData().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
