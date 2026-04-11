const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
const Group = require('./models/Group');
const Category = require('./models/Category');
require('dotenv').config({ path: './.env' });

const MONGO_URI = process.env.MONGO_URI;

const CONFESSIONS = [
    "I still haven't told my parents I changed my major to Arts. They think I'm doing Engineering. 🎨",
    "I secretly use my roommate's expensive shampoo. It just smells so good. 🤫",
    "I actually liked the ending of Game of Thrones. Please don't hate me. 🐉",
    "I've been 'working from home' but actually I've been at the beach for 3 days. 🏖️",
    "I once accidentally sent a screenshot of a chat to the person I was making fun of. 💀",
    "I think I'm in love with my best friend’s sibling. What do I do? ❤️",
    "I pretend to be busy when I see people I know in public so I don't have to talk. 🏃‍♂️",
    "I stole a pen from work 2 years ago and I still feel guilty about it. 🖋️",
    "I have a secret collection of vintage rubber ducks. 🦆",
    "I often order two meals at the drive-thru so they think I'm not eating alone. 🍔"
];

const COMMUNITIES = [
    { name: "Tech Innovators", bio: "Discussing the future of AI, Gadgets, and Web Development.", category: "tech" },
    { name: "Film Fanatics", bio: "Everything from Bollywood to Hollywood. Let's talk movies!", category: "entertainment" },
    { name: "Student Life", bio: "Tips for exams, dorm life, and surviving university.", category: "education" },
    { name: "Entrepreneur Mindset", bio: "A space for future business leaders to connect and grow.", category: "business" },
    { name: "Global Foodies", bio: "Share your favorite recipes and restaurant finds.", category: "food" }
];

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const users = await User.find().limit(20);
        if (users.length === 0) {
            console.log('No users found. Please run user seeder first.');
            process.exit(1);
        }

        console.log('Seeding Confessions...');
        for (let i = 0; i < 20; i++) {
            const user = users[Math.floor(Math.random() * users.length)];
            const text = CONFESSIONS[i % CONFESSIONS.length] + " (Seed #" + i + ")";
            const post = new Post({
                caption: text,
                category: "confessions",
                isAnonymous: true,
                user: {
                    _id: user._id,
                    fullname: "Anonymous",
                    profile_picture: "https://ui-avatars.com/api/?name=A&background=808bf5&color=fff"
                },
                score: Math.floor(Math.random() * 100),
                likes: users.slice(0, Math.floor(Math.random() * 10)).map(u => u._id)
            });
            await post.save();
        }

        console.log('Seeding Communities...');
        for (const comm of COMMUNITIES) {
            const exists = await Group.findOne({ name: comm.name });
            if (!exists) {
                const admin = users[Math.floor(Math.random() * users.length)];
                const group = new Group({
                    name: comm.name,
                    description: comm.bio,
                    creator: admin._id,
                    admins: [admin._id],
                    members: [admin._id, ...users.slice(0, 5).map(u => u._id)],
                    isPrivate: false
                });
                await group.save();
            }
        }

        console.log('Seeding complete!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

seed();
