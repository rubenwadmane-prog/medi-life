const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const passport = require('../config/passport');
const supabase = require('../db/database');
const { generateAccessToken } = require('../middleware/auth');

// ─── Helper ───────────────────────────────────────────────────────────────────
function safeUser(u) {
  return { id: u.id, name: u.name, email: u.email, avatar: u.avatar, provider: u.provider, createdAt: u.created_at };
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'name, email and password are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const id   = uuidv4();

    const { error } = await supabase.from('users').insert({
      id,
      name:     name.trim(),
      email:    email.toLowerCase(),
      password: hash,
      provider: 'local',
    });
    if (error) throw error;

    const { data: user } = await supabase.from('users').select('*').eq('id', id).single();
    const token = generateAccessToken(user);
    res.status(201).json({ token, user: safeUser(user) });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'email and password are required' });

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (!user || !user.password)
      return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateAccessToken(user);
    res.json({ token, user: safeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', require('../middleware/auth').verifyToken, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

// ─── GET /api/auth/google ─────────────────────────────────────────────────────
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })
);

// ─── GET /api/auth/google/callback ────────────────────────────────────────────
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_failed`,
    session: false,
  }),
  (req, res) => {
    const token = generateAccessToken(req.user);
    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendURL}?token=${token}&name=${encodeURIComponent(req.user.name)}`);
  }
);

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
