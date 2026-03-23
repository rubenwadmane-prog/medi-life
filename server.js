require('dotenv').config();

const express        = require('express');
const cors           = require('cors');
const helmet         = require('helmet');
const morgan         = require('morgan');
const session        = require('express-session');
const rateLimit      = require('express-rate-limit');
const passport       = require('./config/passport');
const path           = require('path');

// ─── Routes ───────────────────────────────────────────────────────────────────
const authRoutes          = require('./routes/auth');
const consultationRoutes  = require('./routes/consultations');
const aiRoutes            = require('./routes/ai');
const userRoutes          = require('./routes/users');

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // handled separately if needed
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:5500',  // VS Code Live Server
    'http://127.0.0.1:5500',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging ──────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ─── Session (only needed for passport OAuth redirect flow) ───────────────────
app.use(session({
  secret:            process.env.SESSION_SECRET || 'arogya_session_secret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   10 * 60 * 1000, // 10 minutes — only for OAuth handshake
  },
}));

// ─── Passport ─────────────────────────────────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());

// ─── Rate limiting ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      20,
  message:  { error: 'Too many auth attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders:   false,
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max:      10,
  message:  { error: 'Too many AI requests, please slow down' },
});

// ─── Mount routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',          authLimiter, authRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/ai',            aiLimiter, aiRoutes);
app.use('/api/users',         userRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:  'ok',
    service: 'Arogya API',
    version: '1.0.0',
    time:    new Date().toISOString(),
  });
});

// ─── Serve frontend (if built) ────────────────────────────────────────────────
const frontendDist = path.join(__dirname, '../public');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  const indexFile = path.join(frontendDist, 'index.html');
  const fs = require('fs');
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ┌──────────────────────────────────────────┐
  │   🩺  Arogya API running                  │
  │   Port : ${PORT}                              │
  │   Mode : ${process.env.NODE_ENV || 'development'}                   │
  │   Health: http://localhost:${PORT}/api/health │
  └──────────────────────────────────────────┘
  `);
});

module.exports = app;
