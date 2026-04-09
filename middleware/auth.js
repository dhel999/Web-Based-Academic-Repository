const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'acadrepo-secret-key-change-in-production';

/**
 * Middleware: require a valid JWT token in Authorization header or cookie.
 */
function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, role, full_name }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware: require admin role.
 */
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

/**
 * Optional auth: attach user if token present, but don't block.
 */
function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch { /* ignore */ }
  }
  next();
}

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

module.exports = { requireAuth, requireAdmin, optionalAuth, signToken, JWT_SECRET };
