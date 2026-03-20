/**
 * Run this ONCE to create all production indexes:
 *   node scripts/createIndexes.js
 *
 * These indexes are critical for performance at 100k+ users.
 * Without them MongoDB does full collection scans.
 */

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');

async function createIndexes() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // ─── USERS ────────────────────────────────────────────────────────────────
    const users = db.collection('users');
    await users.createIndex({ email: 1 },        { unique: true, name: 'email_unique' });
    await users.createIndex({ created_at: -1 },  { name: 'users_created_at' });
    await users.createIndex({ isBanned: 1 },     { sparse: true, name: 'users_banned' });
    await users.createIndex({ isAdmin: 1 },      { sparse: true, name: 'users_admin' });
    await users.createIndex({ googleId: 1 },     { sparse: true, name: 'users_google_id' });
    // Text index for search — covers fullname + email
    await users.createIndex({ fullname: 'text', email: 'text' }, { name: 'users_text_search' });
    console.log('✅ Users indexes created');

    // ─── POSTS ────────────────────────────────────────────────────────────────
    const posts = db.collection('posts');
    await posts.createIndex({ createdAt: -1 },                           { name: 'posts_created_at' });
    await posts.createIndex({ score: -1, createdAt: -1 },               { name: 'posts_feed_score' });
    await posts.createIndex({ 'user._id': 1, createdAt: -1 },           { name: 'posts_by_user' });
    await posts.createIndex({ isAnonymous: 1, createdAt: -1 },          { sparse: true, name: 'posts_anonymous' });
    await posts.createIndex({ unlocksAt: 1 },                           { sparse: true, name: 'posts_time_locked' });
    await posts.createIndex({ expiresAt: 1 },                           { expireAfterSeconds: 0, sparse: true, name: 'posts_ttl_expiry' });
    await posts.createIndex({ category: 1, createdAt: -1 },             { name: 'posts_category' });
    await posts.createIndex({ caption: 'text' },                         { name: 'posts_text_search' });
    // For collaborative posts
    await posts.createIndex({ 'collaborators.userId': 1, 'collaborators.status': 1 }, { sparse: true, name: 'posts_collaborators' });
    console.log('✅ Posts indexes created');

    // ─── COMMENTS ─────────────────────────────────────────────────────────────
    const comments = db.collection('comments');
    await comments.createIndex({ postId: 1, createdAt: 1 },  { name: 'comments_by_post' });
    await comments.createIndex({ parentId: 1 },              { sparse: true, name: 'comments_replies' });
    await comments.createIndex({ 'user._id': 1 },            { name: 'comments_by_user' });
    console.log('✅ Comments indexes created');

    // ─── STORIES ──────────────────────────────────────────────────────────────
    const stories = db.collection('stories');
    await stories.createIndex({ 'user._id': 1, createdAt: -1 }, { name: 'stories_by_user' });
    await stories.createIndex({ expiresAt: 1 },                  { expireAfterSeconds: 0, name: 'stories_ttl' });
    console.log('✅ Stories indexes created');

    // ─── CONVERSATIONS ────────────────────────────────────────────────────────
    const convs = db.collection('conversations');
    await convs.createIndex({ 'participants.userId': 1 },        { name: 'convs_by_participant' });
    await convs.createIndex({ lastMessageAt: -1 },               { name: 'convs_last_message' });
    console.log('✅ Conversations indexes created');

    // ─── MESSAGES ─────────────────────────────────────────────────────────────
    const messages = db.collection('messages');
    await messages.createIndex({ conversationId: 1, createdAt: 1 }, { name: 'messages_by_conv' });
    await messages.createIndex({ sender: 1 },                        { name: 'messages_by_sender' });
    await messages.createIndex({ isRead: 1 },                        { name: 'messages_unread' });
    console.log('✅ Messages indexes created');

    // ─── NOTIFICATIONS ────────────────────────────────────────────────────────
    const notifs = db.collection('notifications');
    await notifs.createIndex({ recipient: 1, read: 1, createdAt: -1 }, { name: 'notifs_by_recipient' });
    await notifs.createIndex({ createdAt: 1 },                          { expireAfterSeconds: 30 * 86400, name: 'notifs_ttl_30d' }); // auto-delete after 30 days
    console.log('✅ Notifications indexes created');

    // ─── REPORTS ──────────────────────────────────────────────────────────────
    const reports = db.collection('reports');
    await reports.createIndex({ reporter: 1, targetId: 1, status: 1 }, { name: 'reports_dedup' });
    await reports.createIndex({ status: 1, createdAt: -1 },            { name: 'reports_by_status' });
    await reports.createIndex({ targetId: 1, targetType: 1 },          { name: 'reports_by_target' });
    console.log('✅ Reports indexes created');

    // ─── LOGIN SESSIONS ───────────────────────────────────────────────────────
    const sessions = db.collection('loginsessions');
    await sessions.createIndex({ userId: 1 },      { name: 'sessions_by_user' });
    await sessions.createIndex({ expiresAt: 1 },   { expireAfterSeconds: 0, name: 'sessions_ttl' });
    console.log('✅ Login sessions indexes created');

    // ─── FEED ─────────────────────────────────────────────────────────────────
    const feed = db.collection('feeds');
    await feed.createIndex({ userId: 1, post: 1 }, { unique: true, name: 'feed_unique' });
    await feed.createIndex({ userId: 1 },           { name: 'feed_by_user' });
    console.log('✅ Feed indexes created');

    console.log('\n🎉 All indexes created successfully!');
    process.exit(0);
}

createIndexes().catch(err => { console.error('❌ Error:', err); process.exit(1); });