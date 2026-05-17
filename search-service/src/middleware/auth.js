'use strict';

const jwt = require('jsonwebtoken');
const axios = require('axios');

/**
 * Verify JWT locally (fast path), then optionally confirm with auth-service.
 * For protected routes inside the microservices mesh we trust local verification.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Search auth middleware error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Verify token through auth-service (checks Redis blacklist too).
 * Use this for sensitive operations that need full revocation checking.
 */
async function authenticateViaService(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  try {
    const authUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
    const response = await axios.get(`${authUrl}/auth/verify`, {
      headers: { Authorization: authHeader },
      timeout: 5000,
    });

    req.user = response.data.user;
    req.token = authHeader.slice(7);
    next();
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    console.error('Auth service verification error:', err.message);
    return res.status(503).json({ error: 'Authentication service unavailable' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}` });
    }
    next();
  };
}

module.exports = { authenticate, authenticateViaService, requireRole };
