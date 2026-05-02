require('dotenv').config({ override: true });

const mongoose = require('mongoose');
const { logError } = require('../utils/errorHandler');
require('./models/BotGroup');
require('./models/Contribution');
require('./models/Story');
require('./models/User');

async function connectDB() {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error('MONGO_URI is not set in .env');
    }

    console.log('🔌 Connecting to DB...');

    await mongoose.connect(mongoUri);
    await mongoose.connection.syncIndexes();

    console.log('✅ MongoDB Connected');
  } catch (error) {
    logError('MongoDB connection failed', error);
    throw error;
  }
}

module.exports = connectDB;
