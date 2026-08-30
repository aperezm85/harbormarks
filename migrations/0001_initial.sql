CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  favicon TEXT,
  preview_image TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  visit_count INTEGER NOT NULL DEFAULT 0,
  tags TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;

ALTER TABLE bookmarks
  ADD COLUMN IF NOT EXISTS visit_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE bookmarks
  ADD COLUMN IF NOT EXISTS preview_image TEXT;

ALTER TABLE bookmarks
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id
  ON bookmarks(user_id);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created_at
  ON bookmarks(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_visit_count
  ON bookmarks(user_id, visit_count DESC);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_favorites
  ON bookmarks(user_id, created_at DESC)
  WHERE is_favorite = TRUE;

CREATE INDEX IF NOT EXISTS idx_sessions_user_id
  ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id
  ON email_verification_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
  ON password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_bookmarks_url_trgm
  ON bookmarks USING gin (url gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_bookmarks_title_trgm
  ON bookmarks USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_bookmarks_description_trgm
  ON bookmarks USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_bookmarks_tags_trgm
  ON bookmarks USING gin (tags gin_trgm_ops);