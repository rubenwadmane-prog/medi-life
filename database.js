const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/arogya.db';
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    password    TEXT,                        -- NULL for Google OAuth users
    google_id   TEXT UNIQUE,
    avatar      TEXT,
    provider    TEXT NOT NULL DEFAULT 'local', -- 'local' | 'google'
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS consultations (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL,
    symptoms      TEXT NOT NULL,
    mode          TEXT NOT NULL,             -- 'online' | 'offline'
    summary       TEXT,
    conditions    TEXT,                      -- JSON array
    specialist    TEXT,
    urgency       TEXT,
    ai_response   TEXT,                      -- full JSON response from AI
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS doctors (
    id            TEXT PRIMARY KEY,
    consultation_id TEXT NOT NULL,
    name          TEXT NOT NULL,
    specialisation TEXT,
    hospital      TEXT,
    distance      TEXT,
    rating        REAL,
    type          TEXT,                      -- 'nearby' | 'best'
    FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    token       TEXT UNIQUE NOT NULL,
    expires_at  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_consultations_user ON consultations(user_id);
  CREATE INDEX IF NOT EXISTS idx_consultations_created ON consultations(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_google ON users(google_id);
`);

module.exports = db;
