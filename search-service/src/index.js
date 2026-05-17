'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { connectMongo } = require('./db');
const searchRouter = require('./routes/search');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'search-service',
    timestamp: new Date().toISOString(),
  });
});

app.use('/search', searchRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

async function start() {
  try {
    await connectMongo();
    console.log('MongoDB connected successfully');

    app.listen(PORT, () => {
      console.log(`Search service running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start search service:', err);
    process.exit(1);
  }
}

start();
