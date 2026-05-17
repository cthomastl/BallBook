'use strict';

const mongoose = require('mongoose');

async function connectMongo() {
  const url = process.env.MONGO_URL || 'mongodb://localhost:27017/ballbook_search';

  mongoose.connection.on('connected', () => {
    console.log('MongoDB connected to', url);
  });

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });

  await mongoose.connect(url, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
}

module.exports = { connectMongo };
