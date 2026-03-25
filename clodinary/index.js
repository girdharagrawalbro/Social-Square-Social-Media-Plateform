require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

const rawCorsOrigins = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '*';
const allowedOrigins = rawCorsOrigins
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
const allowAllOrigins = allowedOrigins.includes('*');

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowAllOrigins || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));

app.use(express.json({ limit: '10mb' })); // IMPORTANT for base64

const cloudinaryRoutes = require('./routes/cloudinary.routes');

app.use('/api/cloudinary', cloudinaryRoutes);

const PORT = Number(process.env.PORT || 5001);
app.listen(PORT, () => {
    console.log(`Cloudinary Server running on port http://localhost:${PORT}`);
});