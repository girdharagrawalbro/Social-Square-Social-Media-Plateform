const connect = require('./server/db');
const User = require('./server/models/User');

connect().then(async () => {
    const user = await User.findOne({ notInterestedPosts: { $exists: true, $ne: [] } }).select('fullname notInterestedPosts').lean();
    console.log("User with notInterestedPosts:", user);
    process.exit(0);
}).catch(console.error);
