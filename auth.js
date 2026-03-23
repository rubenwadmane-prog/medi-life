const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const passport = require('../config/passport');
const db       = require('../db/database');
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

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const id   = uuidv4();
    db.prepare(`
      INSERT INTO users (id, name, email, password, provider)
      VALUES (?, ?, ?, ?, 'local')
    `).run(id, name.trim(), email.toLowerCase(), hash);

    const user  = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
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

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
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
  passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_failed`, session: false }),
  (req, res) => {
    // Issue JWT and redirect to frontend with token in query param
    // Frontend grabs it from URL and stores in localStorage
    const token = generateAccessToken(req.user);
    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendURL}?token=${token}&name=${encodeURIComponent(req.user.name)}`);
  }
);

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  // JWT is stateless — client just discards token
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
