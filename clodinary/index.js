const express = require('express');
const app = express();

app.use(express.json({ limit: '10mb' })); // IMPORTANT for base64

const cloudinaryRoutes = require('./routes/cloudinary.routes');

app.use('/api/cloudinary', cloudinaryRoutes);

const PORT = Number(process.env.PORT || 5001);
app.listen(PORT, () => {
    console.log(`Cloudinary Server running on port http://localhost:${PORT}`);
});