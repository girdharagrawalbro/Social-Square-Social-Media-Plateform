const mongoose = require('mongoose');

const connectToMongo = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            // ─── Connection pool ─────────────────────────────────────────────
            maxPoolSize:      50,   // max 50 concurrent DB connections per worker
            minPoolSize:      5,    // keep 5 connections warm always
            maxIdleTimeMS:    30000, // close idle connections after 30s

            // ─── Timeouts ────────────────────────────────────────────────────
            serverSelectionTimeoutMS: 5000,   // fail fast if MongoDB unreachable
            socketTimeoutMS:          45000,  // abort slow queries after 45s
            connectTimeoutMS:         10000,  // connection timeout

            // ─── Reliability ─────────────────────────────────────────────────
            retryWrites:  true,   // auto-retry failed writes on replica sets
            retryReads:   true,
            w:            'majority', // write concern — confirmed by majority of replica set
        });

        console.log('[MongoDB] Connected successfully');

        // Log slow queries in development
        if (process.env.NODE_ENV !== 'production') {
            mongoose.set('debug', (collectionName, method, query, doc) => {
                console.log(`[Mongoose] ${collectionName}.${method}`, JSON.stringify(query));
            });
        }

    } catch (err) {
        console.error('[MongoDB] Connection failed:', err.message);
        // Retry after 5 seconds
        setTimeout(connectToMongo, 5000);
    }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Disconnected — attempting reconnect');
    setTimeout(connectToMongo, 3000);
});

mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] Connection error:', err.message);
});

module.exports = connectToMongo;