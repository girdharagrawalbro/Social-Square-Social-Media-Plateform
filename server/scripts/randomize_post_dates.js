/**
 * POST TIMESTAMP RANDOMIZER / DISTRIBUTOR
 *
 * Spreads out bulk-uploaded posts (like Instagram scraped data) that share the same creation time.
 * Preserves the relative chronological order of the posts so stories/sequences stay coherent.
 *
 * Usage:
 *   node scripts/randomize_post_dates.js --username <username> [options]
 *   node scripts/randomize_post_dates.js --auto-detect [options]
 *
 * Options:
 *   --days <number>      Number of days to distribute posts over (default: 30)
 *   --mode <spread|random> Distribution mode:
 *                          - spread: Spreads posts evenly (default)
 *                          - random: Randomly distributes timestamps in the range
 *   --interval <hours>   Interval between posts in spread mode (default: 24)
 *   --dry-run            Show what changes would be made without saving to the database
 */

const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
    path: path.join(__dirname, '../.env')
});

const User = require('../models/User');
const Post = require('../models/Post');

// Parse CLI arguments
const args = process.argv.slice(2);
const help = args.includes('--help') || args.includes('-h');
const dryRun = args.includes('--dry-run');
const autoDetect = args.includes('--auto-detect');

if (help) {
    printUsage();
    process.exit(0);
}

// Helper to get argument value
function getArgValue(flag) {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) {
        return args[idx + 1];
    }
    return null;
}

const usernameArg = getArgValue('--username');
const days = parseInt(getArgValue('--days') || '30', 10);
const mode = getArgValue('--mode') || 'spread';
const intervalHours = parseFloat(getArgValue('--interval') || '24');

if (!usernameArg && !autoDetect) {
    console.error('❌ Error: You must specify either --username <username> or --auto-detect');
    printUsage();
    process.exit(1);
}

if (mode !== 'spread' && mode !== 'random') {
    console.error(`❌ Error: Invalid mode '${mode}'. Must be 'spread' or 'random'.`);
    process.exit(1);
}

function printUsage() {
    console.log(`
Usage:
  node scripts/randomize_post_dates.js [options]

Required (Choose one):
  --username <username>    Target a specific user's posts
  --auto-detect            Auto-detect users who have bulk-uploaded posts (same upload time)

Options:
  --days <number>          Number of days to distribute posts over (default: 30)
  --mode <spread|random>   Distribution mode (default: spread)
  --interval <hours>       Interval between posts in spread mode (default: 24)
  --dry-run                Show the proposed changes without writing to DB
  --help, -h               Show this help message
`);
}

async function run() {
    try {
        console.log('⚡ Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log(' MongoDB Connected.');

        let targetUsers = [];

        if (usernameArg) {
            const user = await User.findOne({ username: usernameArg });
            if (!user) {
                console.error(`❌ Error: User '${usernameArg}' not found in the database.`);
                await mongoose.disconnect();
                process.exit(1);
            }
            targetUsers.push(user);
        } else if (autoDetect) {
            console.log('🔍 Scanning database for users with duplicate upload timestamps...');
            // Group posts by user and createdAt to find exact matches
            const duplicateGroups = await Post.aggregate([
                { $match: { deletedAt: null } },
                {
                    $group: {
                        _id: { userId: '$user._id', createdAt: '$createdAt' },
                        count: { $sum: 1 }
                    }
                },
                { $match: { count: { $gt: 2 } } } // More than 2 posts at the exact same millisecond
            ]);

            if (duplicateGroups.length === 0) {
                console.log('ℹ️ No users found with bulk duplicate upload timestamps.');
                await mongoose.disconnect();
                process.exit(0);
            }

            const userIds = [...new Set(duplicateGroups.map(g => g._id.userId))];
            targetUsers = await User.find({ _id: { $in: userIds } });
            console.log(` Auto-detected ${targetUsers.length} user(s) with bulk-uploaded posts:`, targetUsers.map(u => u.username).join(', '));
        }

        for (const user of targetUsers) {
            console.log(`\n--------------------------------------------------`);
            console.log(`👤 Processing user: ${user.username} (${user.fullname})`);

            // Fetch all posts for this user, sorted by database ID (since createdAt is identical, this preserves insertion order)
            const posts = await Post.find({ 'user._id': user._id, deletedAt: null }).sort({ _id: 1 });

            if (posts.length === 0) {
                console.log(`ℹ️ User has no active posts.`);
                continue;
            }

            console.log(`📊 Total active posts found: ${posts.length}`);

            // Generate new timestamps
            const newTimestamps = [];
            const now = Date.now();

            if (mode === 'spread') {
                // Spread posts evenly going backwards from now
                const intervalMs = intervalHours * 60 * 60 * 1000;
                for (let i = 0; i < posts.length; i++) {
                    // Oldest posts get pushed further back, newest post is close to now
                    const offset = (posts.length - 1 - i) * intervalMs;
                    newTimestamps.push(new Date(now - offset));
                }
            } else if (mode === 'random') {
                // Generate N random timestamps within the last D days
                const rangeMs = days * 24 * 60 * 60 * 1000;
                for (let i = 0; i < posts.length; i++) {
                    const randomOffset = Math.random() * rangeMs;
                    newTimestamps.push(new Date(now - randomOffset));
                }
                // Sort timestamps in ascending order to preserve original chronological sequence of posts
                newTimestamps.sort((a, b) => a - b);
            }

            console.log(`📅 Date distribution range:`);
            console.log(`   - Oldest Post Date: ${newTimestamps[0].toLocaleString()}`);
            console.log(`   - Newest Post Date: ${newTimestamps[newTimestamps.length - 1].toLocaleString()}`);

            if (dryRun) {
                console.log(`\n🔎 [DRY RUN] Showing proposed changes (no database updates made):`);
                for (let i = 0; i < posts.length; i++) {
                    console.log(`   Post [${posts[i]._id}] | Original: ${posts[i].createdAt.toISOString()} ➡️ New: ${newTimestamps[i].toISOString()} | Caption: "${posts[i].caption?.slice(0, 40) || ''}..."`);
                }
            } else {
                console.log(`\n💾 Writing changes to database...`);
                let updatedCount = 0;
                for (let i = 0; i < posts.length; i++) {
                    await Post.updateOne(
                        { _id: posts[i]._id },
                        { $set: { createdAt: newTimestamps[i] } }
                    );
                    updatedCount++;
                }
                console.log(` Successfully updated ${updatedCount} posts for ${user.username}.`);
            }
        }

        console.log(`\n==================================================`);
        console.log(dryRun ? ' Dry run completed successfully.' : ' Database update completed successfully.');
        await mongoose.disconnect();
    } catch (err) {
        console.error('🔥 Fatal Error:', err);
        try {
            await mongoose.disconnect();
        } catch { }
        process.exit(1);
    }
}

run();
