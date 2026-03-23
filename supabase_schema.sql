-- ─── Run this once in your Supabase SQL Editor ───────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT,
  google_id   TEXT UNIQUE,
  avatar      TEXT,
  provider    TEXT NOT NULL DEFAULT 'local',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consultations (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symptoms    TEXT NOT NULL,
  mode        TEXT NOT NULL,
  summary     TEXT,
  conditions  JSONB,
  specialist  TEXT,
  urgency     TEXT,
  ai_response JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS doctors (
  id                TEXT PRIMARY KEY,
  consultation_id   TEXT NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  specialisation    TEXT,
  hospital          TEXT,
  distance          TEXT,
  rating            FLOAT,
  type              TEXT
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consultations_user    ON consultations(user_id);
CREATE INDEX IF NOT EXISTS idx_consultations_created ON consultations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token  ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_users_email           ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google          ON users(google_id);
