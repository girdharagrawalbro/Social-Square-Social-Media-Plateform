const mongoose = require('mongoose');
require('dotenv').config();

const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  console.error('ERROR: MONGO_URI is not defined in environment variables');
  process.exit(1);
}

const connectToMongo = async () => {
  try {
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

module.exports = connectToMongo;
