const mongoose = require('mongoose');

const connectToMongo = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            // ─── Pool: reduced for 512MB target ──────────────────────────────
            // 50 connections × ~1MB = 50MB — too much for 512MB budget
            // 10 is enough for most apps under 10k concurrent users
            maxPoolSize:      10,
            minPoolSize:      2,     // only 2 warm — saves ~8MB idle
            maxIdleTimeMS:    10000, // close idle faster (10s not 30s)

            // ─── Timeouts ─────────────────────────────────────────────────────
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS:          30000,
            connectTimeoutMS:         10000,

            // ─── Reliability ──────────────────────────────────────────────────
            retryWrites: true,
            retryReads:  true,
            // Removed w:'majority' — only for replica sets, not needed on Atlas free tier
        });

        console.log(`[MongoDB] Connected (PID: ${process.pid})`);

        if (process.env.NODE_ENV !== 'production') {
            // Log method only — not full query object (saves memory/string allocation)
            mongoose.set('debug', (col, method) => console.log(`[Mongoose] ${col}.${method}`));
        }

    } catch (err) {
        console.error('[MongoDB] Failed:', err.message);
        setTimeout(connectToMongo, 5000);
    }
};

mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Disconnected — reconnecting...');
    setTimeout(connectToMongo, 3000);
});

mongoose.connection.on('error', (err) => console.error('[MongoDB] Error:', err.message));

module.exports = connectToMongo;