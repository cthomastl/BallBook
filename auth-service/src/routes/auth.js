import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, redisClient } from '../db.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// POST /auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, role, specialization, bio, hourly_rate } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, and role are required' });
  }

  if (!['trainee', 'trainer'].includes(role)) {
    return res.status(400).json({ error: 'role must be either "trainee" or "trainer"' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (role === 'trainer' && !specialization) {
    return res.status(400).json({ error: 'Trainers must provide a specialization' });
  }

  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const result = await query(
      `INSERT INTO users (name, email, password_hash, role, specialization, bio, hourly_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, role, specialization, bio, hourly_rate, created_at`,
      [
        name.trim(),
        email.toLowerCase().trim(),
        password_hash,
        role,
        specialization || null,
        bio || null,
        hourly_rate ? parseFloat(hourly_rate) : null,
      ]
    );

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        specialization: user.specialization,
        bio: user.bio,
        hourly_rate: user.hourly_rate,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const result = await query(
      'SELECT id, name, email, password_hash, role, specialization, bio, hourly_rate, created_at FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        specialization: user.specialization,
        bio: user.bio,
        hourly_rate: user.hourly_rate,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    const token = req.token;
    const decoded = req.user;

    // Calculate remaining TTL so the key expires when the token would have anyway
    const now = Math.floor(Date.now() / 1000);
    const ttl = decoded.exp - now;

    if (ttl > 0) {
      await redisClient.setEx(`blacklist:${token}`, ttl, '1');
    }

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/verify
router.get('/verify', authenticate, (req, res) => {
  return res.status(200).json({
    valid: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      name: req.user.name,
    },
  });
});

// GET /auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, email, role, specialization, bio, hourly_rate, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ user: result.rows[0] });
  } catch (err) {
    console.error('Get me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/trainers — used internally by search-service
router.get('/trainers', async (req, res) => {
  try {
    const { ids } = req.query;

    let result;
    if (ids) {
      // Fetch specific trainer IDs (comma-separated)
      const idList = ids.split(',').map((id) => id.trim()).filter(Boolean);
      if (idList.length === 0) {
        return res.status(200).json({ trainers: [] });
      }
      // Build parameterized query for array of IDs
      const placeholders = idList.map((_, i) => `$${i + 1}`).join(', ');
      result = await query(
        `SELECT id, name, email, role, specialization, bio, hourly_rate, created_at
         FROM users
         WHERE role = 'trainer' AND id IN (${placeholders})`,
        idList
      );
    } else {
      result = await query(
        `SELECT id, name, email, role, specialization, bio, hourly_rate, created_at
         FROM users
         WHERE role = 'trainer'
         ORDER BY created_at DESC`,
        []
      );
    }

    return res.status(200).json({ trainers: result.rows });
  } catch (err) {
    console.error('Get trainers error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
