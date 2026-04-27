const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from parent directory relative to current script in scratch folder
dotenv.config({ path: path.join(__dirname, '../.env') });

const { runAdminDigests } = require('../queues/digestQueue');

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('DB Connected. Triggering Admin digests...');
        await runAdminDigests();
        console.log('Admin digests run completed successfully.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Test failed:', err.message);
        process.exit(1);
    });
