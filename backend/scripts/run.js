/**
 * Social Square — Comprehensive Seed Script
 *
 * Generates:
 *   - 1,000 users (80% public, 20% private)
 *   - ~25,000 posts (90% standard, 10% anonymous with HMAC ownerToken)
 *   - Realistic social graph (~15% follow density)
 *   - Pending follow requests, blocks, mutes
 *   - Active + expired sessions (to test 401 cascade)
 *   - PostVectors for similarity testing
 *   - LoginSessions with mix of valid/expired tokens
 *
 * Usage:
 *   node seed.js
 *
 * Requires:
 *   npm install mongoose faker jsonwebtoken dotenv
 *
 * Set in .env:
 *   MONGO_URI=mongodb://localhost:27017/social_square
 *   JWT_SECRET=your_jwt_secret
 *   PRIVACY_HMAC_SECRET_V1=your_hmac_secret
 *   REFRESH_TOKEN_SECRET=your_refresh_secret
 */

require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { faker } = require('@faker-js/faker');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
    TOTAL_USERS: 1000,
    PUBLIC_RATIO: 0.80,
    POSTS_PER_USER_MIN: 15,
    POSTS_PER_USER_MAX: 35,
    ANONYMOUS_RATIO: 0.10,
    FOLLOW_DENSITY: 0.15,        // each user follows ~15% of others
    PENDING_REQUEST_PER_PRIVATE: 8,
    BLOCKED_PER_USER: 3,
    MUTED_PER_USER: 5,
    SESSIONS_PER_USER: 2,        // mix of valid + expired
    BATCH_SIZE: 100,             // insert in batches to avoid memory blow-up
};

const CATEGORIES = [
    'Nature', 'Travel', 'Food', 'Technology', 'Art',
    'Music', 'Sports', 'Fashion', 'Fitness', 'Photography',
    'Gaming', 'Education', 'Comedy', 'Business', 'Lifestyle',
];

const SAMPLE_TAGS = [
    'instagood', 'photooftheday', 'love', 'beautiful', 'happy',
    'cute', 'tbt', 'like4like', 'follow', 'followme',
    'nature', 'travel', 'food', 'fitness', 'art',
    'music', 'photography', 'style', 'fashion', 'design',
];

const AVATAR_BASE = 'https://api.dicebear.com/7.x/avataaars/svg?seed=';
const IMAGE_BASE = 'https://picsum.photos/seed/';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickN = (arr, n) => [...arr].sort(() => 0.5 - Math.random()).slice(0, n);
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const chance = (p) => Math.random() < p;

function hmac(userId) {
    return crypto
        .createHmac('sha256', process.env.PRIVACY_HMAC_SECRET_V1 || 'dev_hmac_secret')
        .update(userId.toString())
        .digest('hex');
}

function makeAccessToken(userId, expiresIn = '15m') {
    return jwt.sign(
        { userId, id: userId },
        process.env.JWT_SECRET || 'dev_jwt_secret',
        { expiresIn }
    );
}

function makeRefreshToken(userId) {
    return jwt.sign(
        { userId },
        process.env.REFRESH_TOKEN_SECRET || 'dev_refresh_secret',
        { expiresIn: '30d' }
    );
}

// ─── SCHEMAS (inline — adjust to match your actual models) ───────────────────

const UserSchema = new mongoose.Schema({
    fullname: String,
    username: { type: String, unique: true },
    email: { type: String, unique: true },
    password: String,
    bio: String,
    profile_picture: String,
    isPrivate: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    followRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    mutedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    followerCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    postCount: { type: Number, default: 0 },
    profileViews: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    streak: { count: { type: Number, default: 0 } },
    twoFactorEnabled: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

const PostSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    authorId: String,
    fullname: String,
    profile_picture: String,
    caption: String,
    imageURLs: [String],
    video: String,
    category: String,
    tags: [String],
    isAnonymous: { type: Boolean, default: false },
    ownerToken: { type: String, select: false },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    isPrivate: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

const PostVectorSchema = new mongoose.Schema({
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
    vector: [Number],
    category: String,
    tags: [String],
    createdAt: { type: Date, default: Date.now },
});

const LoginSessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    token: String,
    refreshToken: String,
    fingerprint: String,
    userAgent: String,
    isValid: { type: Boolean, default: true },
    expiresAt: Date,
    createdAt: { type: Date, default: Date.now },
});

// ─── MODELS ──────────────────────────────────────────────────────────────────
const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Post = mongoose.models.Post || mongoose.model('Post', PostSchema);
const PostVector = mongoose.models.PostVector || mongoose.model('PostVector', PostVectorSchema);
const LoginSession = mongoose.models.LoginSession || mongoose.model('LoginSession', LoginSessionSchema);

// ─── INDIAN NAMES POOL ───────────────────────────────────────────────────────
const INDIAN_FIRST = [
    'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
    'Shaurya', 'Atharva', 'Advik', 'Pranav', 'Advaith', 'Dhruv', 'Kabir', 'Ritvik', 'Aarush', 'Karan',
    'Priya', 'Ananya', 'Diya', 'Riya', 'Pooja', 'Kavya', 'Shreya', 'Isha', 'Aisha', 'Nisha',
    'Meera', 'Divya', 'Sneha', 'Swati', 'Anjali', 'Neha', 'Sakshi', 'Tanvi', 'Anika', 'Rhea',
    'Rohan', 'Rahul', 'Raj', 'Vikram', 'Nikhil', 'Amit', 'Suresh', 'Ramesh', 'Deepak', 'Manoj',
    'Sunita', 'Geeta', 'Rekha', 'Sita', 'Radha', 'Kamla', 'Lata', 'Usha', 'Sarla', 'Manju',
    'Ishan', 'Parth', 'Yash', 'Dev', 'Harsh', 'Kunal', 'Varun', 'Siddharth', 'Gaurav', 'Tarun',
    'Zara', 'Sara', 'Tara', 'Noor', 'Reem', 'Layla', 'Farah', 'Hana', 'Sana', 'Aara',
    'Girish', 'Sunil', 'Anil', 'Ravi', 'Sanjay', 'Vijay', 'Ajay', 'Akash', 'Prakash', 'Mahesh',
    'Lakshmi', 'Saraswati', 'Parvati', 'Durga', 'Kali', 'Sati', 'Uma', 'Gauri', 'Sushma', 'Sudha',
];

const INDIAN_LAST = [
    'Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Patel', 'Shah', 'Mehta', 'Joshi', 'Mishra',
    'Nair', 'Menon', 'Pillai', 'Iyer', 'Iyengar', 'Krishnan', 'Rajan', 'Subramaniam', 'Venkat', 'Reddy',
    'Rao', 'Naidu', 'Chandra', 'Murthy', 'Prasad', 'Srinivas', 'Lakshmanan', 'Raghavan', 'Balasubramanian', 'Natarajan',
    'Chopra', 'Kapoor', 'Malhotra', 'Bhatia', 'Anand', 'Saxena', 'Agarwal', 'Bansal', 'Garg', 'Mittal',
    'Khan', 'Ansari', 'Shaikh', 'Siddiqui', 'Qureshi', 'Malik', 'Hussain', 'Ahmed', 'Ali', 'Mirza',
    'Das', 'Dey', 'Ghosh', 'Mukherjee', 'Chatterjee', 'Banerjee', 'Bose', 'Sen', 'Roy', 'Chakraborty',
    'Desai', 'Jain', 'Gandhi', 'Parekh', 'Modi', 'Trivedi', 'Pandya', 'Bhatt', 'Dave', 'Shukla',
    'Tiwari', 'Yadav', 'Dubey', 'Pandey', 'Soni', 'Rawat', 'Chauhan', 'Thakur', 'Rajput', 'Rana',
    'Gowda', 'Hegde', 'Shetty', 'Kamath', 'Bhat', 'Nayak', 'Pai', 'Mallya', 'Shenoy', 'Amin',
    'Biswas', 'Sarkar', 'Mondal', 'Mitra', 'Saha', 'Pal', 'Basak', 'Bhattacharya', 'Haldar', 'Majumdar',
];

const INDIAN_CITIES = [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad',
    'Jaipur', 'Lucknow', 'Kochi', 'Chandigarh', 'Bhopal', 'Indore', 'Nagpur', 'Surat',
    'Raipur', 'Patna', 'Bhubaneswar', 'Visakhapatnam', 'Coimbatore', 'Mysore', 'Vadodara', 'Agra',
];

function indianName() {
    return `${pick(INDIAN_FIRST)} ${pick(INDIAN_LAST)}`;
}

function indianBio() {
    const city = pick(INDIAN_CITIES);
    const emojis = ['📸', '✨', '🌸', '🚀', '🎵', '🏏', '🍛', '🌺', '💫', '🎭', '🌴', '☕'];
    const hooks = [
        `${city} based creator`,
        `Living life in ${city}`,
        `${city} | Exploring every day`,
        `Born and raised in ${city}`,
        `${city} vibes only`,
    ];
    return `${pick(hooks)} ${pick(emojis)}`;
}



async function seedUsers() {
    console.log('\n[1/5] Seeding users...');
    const users = [];
    const usedUsernames = new Set();
    const usedEmails = new Set();

    for (let i = 0; i < CONFIG.TOTAL_USERS; i++) {
        let username, email;
        do {
            const fn = pick(INDIAN_FIRST).toLowerCase();
            const ln = pick(INDIAN_LAST).toLowerCase();
            const suffix = chance(0.5) ? `_${randInt(1, 999)}` : (chance(0.3) ? `_${pick(INDIAN_CITIES).toLowerCase().replace(/ /g, '_')}` : '');
            username = `${fn}_${ln}${suffix}`.replace(/[^a-z0-9_]/g, '_').slice(0, 28);
        }
        while (usedUsernames.has(username));
        usedUsernames.add(username);

        do { email = faker.internet.email().toLowerCase(); }
        while (usedEmails.has(email));
        usedEmails.add(email);

        const isPrivate = chance(1 - CONFIG.PUBLIC_RATIO);
        const level = randInt(1, 50);
        const xp = level * randInt(100, 500);
        const streakCount = randInt(0, 365);

        users.push({
            fullname: indianName(),
            username,
            email,
            password: '$2b$10$hashedpassword_placeholder', // bcrypt hash placeholder
            bio: chance(0.7) ? indianBio() : '',
            profile_picture: `${AVATAR_BASE}${username}`,
            isPrivate,
            isOnline: chance(0.2),
            isVerified: chance(0.05),
            emailVerified: true,
            level,
            xp,
            streak: { count: streakCount },
            profileViews: randInt(0, 50000),
            followerCount: 0, // updated after graph is built
            followingCount: 0,
            postCount: 0,
            createdAt: faker.date.between({ from: '2023-01-01', to: new Date() }),
        });

        if ((i + 1) % 100 === 0) process.stdout.write(`  ${i + 1}/${CONFIG.TOTAL_USERS}\r`);
    }

    const inserted = [];
    for (let i = 0; i < users.length; i += CONFIG.BATCH_SIZE) {
        const batch = await User.insertMany(users.slice(i, i + CONFIG.BATCH_SIZE));
        inserted.push(...batch);
    }
    console.log(`  ✓ Inserted ${inserted.length} users`);
    return inserted;
}

async function seedSocialGraph(users) {
    console.log('\n[2/5] Building social graph...');
    const ids = users.map(u => u._id);
    let followCount = 0;

    for (let i = 0; i < users.length; i++) {
        const me = users[i];
        // Pick ~15% of other users to follow
        const candidates = ids.filter(id => !id.equals(me._id));
        const toFollow = pickN(candidates, Math.floor(candidates.length * CONFIG.FOLLOW_DENSITY));

        // Split: accepted follows vs pending requests (only to private accounts)
        const privateIds = new Set(users.filter(u => u.isPrivate).map(u => u._id.toString()));

        const accepted = toFollow.filter(id => !privateIds.has(id.toString()) || chance(0.6));
        const pending = toFollow.filter(id => privateIds.has(id.toString()) && !accepted.includes(id));

        // Accepted follows
        await User.updateOne({ _id: me._id }, {
            $addToSet: { following: { $each: accepted } },
            $inc: { followingCount: accepted.length },
        });
        for (const targetId of accepted) {
            await User.updateOne({ _id: targetId }, {
                $addToSet: { followers: me._id },
                $inc: { followerCount: 1 },
            });
        }

        // Pending requests (subset, max CONFIG.PENDING_REQUEST_PER_PRIVATE)
        const pendingSlice = pending.slice(0, CONFIG.PENDING_REQUEST_PER_PRIVATE);
        for (const targetId of pendingSlice) {
            await User.updateOne({ _id: targetId }, {
                $addToSet: { followRequests: me._id },
            });
        }

        followCount += accepted.length;
        if ((i + 1) % 100 === 0) process.stdout.write(`  ${i + 1}/${users.length} users graphed\r`);
    }

    // Blocks and mutes (small sets, no overlap with following)
    for (const user of users) {
        const others = ids.filter(id => !id.equals(user._id));
        const blocks = pickN(others, CONFIG.BLOCKED_PER_USER);
        const mutes = pickN(others.filter(id => !blocks.some(b => b.equals(id))), CONFIG.MUTED_PER_USER);
        await User.updateOne({ _id: user._id }, {
            $addToSet: { blockedUsers: { $each: blocks }, mutedUsers: { $each: mutes } },
        });
    }

    console.log(`  ✓ ~${followCount} follow relationships created`);
}

async function seedPosts(users) {
    console.log('\n[3/5] Seeding posts...');
    let totalPosts = 0;
    const allPostIds = [];

    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const nPosts = randInt(CONFIG.POSTS_PER_USER_MIN, CONFIG.POSTS_PER_USER_MAX);
        const posts = [];

        for (let j = 0; j < nPosts; j++) {
            const isAnon = chance(CONFIG.ANONYMOUS_RATIO);
            const isVideo = chance(0.15);
            const imgSeed = `${user.username}_${j}`;
            const tags = pickN(SAMPLE_TAGS, randInt(2, 6));
            const cat = pick(CATEGORIES);
            const nImgs = isVideo ? 0 : randInt(1, 4);

            const post = {
                user: isAnon ? new mongoose.Types.ObjectId() : user._id,
                authorId: isAnon ? 'anonymous' : user._id.toString(),
                fullname: isAnon ? 'Anonymous' : user.fullname,
                profile_picture: isAnon ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=anon' : user.profile_picture,
                caption: faker.lorem.sentences(randInt(1, 3)),
                imageURLs: isVideo ? [] : Array.from({ length: nImgs }, (_, k) => `${IMAGE_BASE}${imgSeed}_${k}/800/800`),
                video: isVideo ? `https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_${j % 5 + 1}mb.mp4` : undefined,
                category: cat,
                tags,
                isAnonymous: isAnon,
                ownerToken: isAnon ? hmac(user._id.toString()) : undefined,
                likeCount: randInt(0, 5000),
                commentCount: randInt(0, 500),
                createdAt: faker.date.between({ from: user.createdAt, to: new Date() }),
            };

            posts.push(post);
        }

        const inserted = await Post.insertMany(posts);
        allPostIds.push(...inserted.map(p => p._id));
        await User.updateOne({ _id: user._id }, { $inc: { postCount: posts.length } });

        totalPosts += posts.length;
        if ((i + 1) % 100 === 0) process.stdout.write(`  ${i + 1}/${users.length} users done (${totalPosts} posts)\r`);
    }

    console.log(`  ✓ Inserted ${totalPosts} posts`);
    return allPostIds;
}

async function seedPostVectors(postIds) {
    console.log('\n[4/5] Seeding post vectors...');
    // Only vectorize 85% of posts (15% intentionally unvectorized to test fallback path)
    const toVectorize = postIds.filter(() => chance(0.85));
    const vectors = [];

    for (const postId of toVectorize) {
        // Fake 128-dim unit vector (cosine similarity needs normalized vectors)
        const raw = Array.from({ length: 128 }, () => (Math.random() * 2 - 1));
        const mag = Math.sqrt(raw.reduce((s, v) => s + v * v, 0));
        const vec = raw.map(v => v / mag);

        vectors.push({ postId, vector: vec, createdAt: new Date() });

        if (vectors.length % 500 === 0) process.stdout.write(`  ${vectors.length}/${toVectorize.length}\r`);
    }

    for (let i = 0; i < vectors.length; i += CONFIG.BATCH_SIZE * 5) {
        await PostVector.insertMany(vectors.slice(i, i + CONFIG.BATCH_SIZE * 5));
    }

    console.log(`  ✓ Inserted ${vectors.length} post vectors (${postIds.length - toVectorize.length} left unvectorized for fallback tests)`);
}

async function seedSessions(users) {
    console.log('\n[5/5] Seeding login sessions...');
    const sessions = [];
    const now = Date.now();

    for (const user of users) {
        for (let s = 0; s < CONFIG.SESSIONS_PER_USER; s++) {
            const isExpired = s === CONFIG.SESSIONS_PER_USER - 1 && chance(0.4); // 40% chance last session is expired
            const expiresAt = isExpired
                ? new Date(now - randInt(1, 7) * 24 * 60 * 60 * 1000)   // expired 1–7 days ago
                : new Date(now + 30 * 24 * 60 * 60 * 1000);              // valid for 30 days

            const accessToken = makeAccessToken(user._id.toString(), isExpired ? '-1s' : '15m');
            const refreshToken = makeRefreshToken(user._id.toString());

            sessions.push({
                userId: user._id,
                token: accessToken,
                refreshToken,
                fingerprint: faker.string.alphanumeric(32),
                userAgent: faker.internet.userAgent(),
                isValid: !isExpired,
                expiresAt,
                createdAt: faker.date.recent({ days: 30 }),
            });
        }
    }

    for (let i = 0; i < sessions.length; i += CONFIG.BATCH_SIZE * 5) {
        await LoginSession.insertMany(sessions.slice(i, i + CONFIG.BATCH_SIZE * 5));
    }

    const expired = sessions.filter(s => !s.isValid).length;
    console.log(`  ✓ Inserted ${sessions.length} sessions (${expired} expired — for 401 cascade tests)`);
}

// ─── SPECIAL EDGE-CASE USERS ─────────────────────────────────────────────────
// These are deterministic users for targeted test cases

async function seedEdgeCaseUsers() {
    console.log('\n[+] Seeding edge-case users for targeted tests...');

    const edgeCases = [
        {
            // The race condition test: private account owner on cold load
            username: 'priya_sharma',
            email: 'priya.sharma@socialsquare.test',
            isPrivate: true,
            fullname: 'Priya Sharma',
            bio: 'Mumbai | Photography & sunsets ✨',
        },
        {
            // 401 cascade test: user with only expired sessions
            username: 'arjun_mehta',
            email: 'arjun.mehta@socialsquare.test',
            isPrivate: false,
            fullname: 'Arjun Mehta',
            bio: 'Delhi boy. Coffee addict. 📸',
        },
        {
            // Anonymous post ownership test
            username: 'kavya_nair',
            email: 'kavya.nair@socialsquare.test',
            isPrivate: false,
            fullname: 'Kavya Nair',
            bio: 'Kochi | Classical dancer | Foodie 🌸',
        },
        {
            // Blocked user test
            username: 'rohit_verma',
            email: 'rohit.verma@socialsquare.test',
            isPrivate: false,
            fullname: 'Rohit Verma',
            bio: 'Jaipur | Tech & travel 🚀',
        },
        {
            // Zero-content private account (to test empty state)
            username: 'ananya_iyer',
            email: 'ananya.iyer@socialsquare.test',
            isPrivate: true,
            fullname: 'Ananya Iyer',
            bio: 'Chennai | Just joined 🙂',
        },
    ];

    const inserted = [];
    for (const u of edgeCases) {
        const existing = await User.findOne({ username: u.username });
        if (existing) { inserted.push(existing); continue; }

        const doc = await User.create({
            ...u,
            password: '$2b$10$hashedpassword_placeholder',
            profile_picture: `${AVATAR_BASE}${u.username}`,
            emailVerified: true,
        });
        inserted.push(doc);
    }

    // Wire up relationships
    const [privateOwner, expiredUser, anonOwner, blocked] = inserted;

    // privateOwner blocks blocked
    await User.updateOne({ _id: privateOwner._id }, { $addToSet: { blockedUsers: blocked._id } });

    // anonOwner gets 5 anonymous posts
    const anonPosts = Array.from({ length: 5 }, (_, i) => ({
        user: new mongoose.Types.ObjectId(),
        authorId: 'anonymous',
        fullname: 'Anonymous',
        profile_picture: `${AVATAR_BASE}anon`,
        caption: faker.lorem.sentence(),
        imageURLs: [`${IMAGE_BASE}anon_${i}/800/800`],
        category: pick(CATEGORIES),
        tags: pickN(SAMPLE_TAGS, 3),
        isAnonymous: true,
        ownerToken: hmac(anonOwner._id.toString()),
        likeCount: randInt(0, 100),
        commentCount: randInt(0, 20),
    }));
    await Post.insertMany(anonPosts);
    await User.updateOne({ _id: anonOwner._id }, { $inc: { postCount: 5 } });

    // expiredUser gets only expired sessions
    await LoginSession.create({
        userId: expiredUser._id,
        token: makeAccessToken(expiredUser._id.toString(), '-1s'),
        refreshToken: 'expired_refresh_token_placeholder',
        fingerprint: faker.string.alphanumeric(32),
        isValid: false,
        expiresAt: new Date(Date.now() - 86400000),
    });

    console.log(`  ✓ Edge-case users ready:`);
    inserted.forEach(u => console.log(`    @${u.username} → ${u._id}`));
    return inserted;
}

// ─── SUMMARY ─────────────────────────────────────────────────────────────────

async function printSummary() {
    const [users, posts, vectors, sessions, anonPosts] = await Promise.all([
        User.countDocuments(),
        Post.countDocuments(),
        PostVector.countDocuments(),
        LoginSession.countDocuments(),
        Post.countDocuments({ isAnonymous: true }),
    ]);

    const privateUsers = await User.countDocuments({ isPrivate: true });
    const expiredSess = await LoginSession.countDocuments({ isValid: false });

    console.log(`
╔══════════════════════════════════════════╗
║         Social Square — Seed Summary     ║
╠══════════════════════════════════════════╣
║  Users          ${String(users).padEnd(26)}║
║  ├─ Public      ${String(users - privateUsers).padEnd(26)}║
║  └─ Private     ${String(privateUsers).padEnd(26)}║
║  Posts          ${String(posts).padEnd(26)}║
║  ├─ Standard    ${String(posts - anonPosts).padEnd(26)}║
║  └─ Anonymous   ${String(anonPosts).padEnd(26)}║
║  Post vectors   ${String(vectors).padEnd(26)}║
║  Sessions       ${String(sessions).padEnd(26)}║
║  └─ Expired     ${String(expiredSess).padEnd(26)}║
╚══════════════════════════════════════════╝

  Edge-case test accounts:
    @priya_sharma     → race condition / private profile
    @arjun_mehta      → 401 cascade on cold load
    @kavya_nair       → HMAC ownership verification
    @rohit_verma      → blocked user profile view
    @ananya_iyer      → empty-state private account
  `);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/social_square';
    console.log(`\nConnecting to ${uri}...`);
    await mongoose.connect(uri);
    console.log('Connected.\n');

    // Safety check — don't nuke a production DB
    const existingUsers = await User.countDocuments();
    if (existingUsers > 100) {
        console.error(`\n⚠ DB already has ${existingUsers} users. Aborting to protect existing data.`);
        console.error('  Set MONGO_URI to a test database or drop the collections manually first.\n');
        process.exit(1);
    }

    const startTime = Date.now();

    const users = await seedUsers();
    await seedSocialGraph(users);
    const postIds = await seedPosts(users);
    await seedPostVectors(postIds);
    await seedSessions(users);
    await seedEdgeCaseUsers();
    await printSummary();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  Done in ${elapsed}s\n`);
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('\nSeed failed:', err);
    mongoose.disconnect();
    process.exit(1);
});