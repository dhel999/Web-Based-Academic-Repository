const bcrypt = require('bcryptjs');
const supabase = require('../utils/supabase');
const { signToken } = require('../middleware/auth');

const SALT_ROUNDS = 10;

/**
 * POST /api/auth/register
 */
async function register(req, res) {
  const { full_name, email, password } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'Full name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    // Check if email already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        full_name: full_name.trim(),
        email: email.toLowerCase().trim(),
        password_hash,
        role: 'user'
      })
      .select('id, full_name, email, role, created_at')
      .single();

    if (error) throw new Error(error.message);

    const token = signToken({ id: user.id, email: user.email, role: user.role, full_name: user.full_name });

    res.status(201).json({ message: 'Account created successfully', token, user });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
}

/**
 * POST /api/auth/login
 */
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, email, password_hash, role, avatar_url, created_at')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role, full_name: user.full_name });

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role, avatar_url: user.avatar_url }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
}

/**
 * GET /api/auth/me — get current user profile
 */
async function getMe(req, res) {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, email, role, avatar_url, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Count user's documents
    const { count } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    res.json({ user: { ...user, document_count: count || 0 } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

module.exports = { register, login, getMe };
