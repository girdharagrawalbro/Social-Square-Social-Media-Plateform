const mongoose = require('mongoose');

// Global plugin to track and warn about slow queries (> 1 second)
mongoose.plugin((schema) => {
    schema.pre(['find', 'findOne', 'aggregate'], function () {
        this._startTime = Date.now();
    });
    schema.post(['find', 'findOne', 'aggregate'], function (result) {
        const duration = Date.now() - (this._startTime || Date.now());
        if (duration > 1000) {
            console.warn(`[SlowQuery] ${this.mongooseCollection?.name || 'unknown'} took ${duration}ms`);
        }
    });
});

const connectToMongo = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            // ─── Pool: reduced for 512MB target ──────────────────────────────
            // 50 connections × ~1MB = 50MB — too much for 512MB budget
            // 10 is enough for most apps under 10k concurrent users
            maxPoolSize: 10,
            minPoolSize: 2,     // only 2 warm — saves ~8MB idle
            maxIdleTimeMS: 10000, // close idle faster (10s not 30s)

            // ─── Timeouts ─────────────────────────────────────────────────────
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 15000, // Reduced from 30s to 15s to fail faster
            connectTimeoutMS: 5000,  // Reduced from 10s to 5s

            // ─── Reliability ──────────────────────────────────────────────────
            retryWrites: true,
            retryReads: true,
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