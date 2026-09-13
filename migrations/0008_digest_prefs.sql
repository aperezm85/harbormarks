-- Weekly digest preferences (one row per user, created lazily on first save).
-- Idempotent; never drops user data. Never edit older migrations.
CREATE TABLE IF NOT EXISTS digest_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  scope TEXT NOT NULL DEFAULT 'unread_7d',
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_digest_preferences_scope'
  ) THEN
    ALTER TABLE digest_preferences
      ADD CONSTRAINT chk_digest_preferences_scope CHECK (scope IN ('unread_7d', 'all_unread', 'all_7d'));
  END IF;
END $$;
