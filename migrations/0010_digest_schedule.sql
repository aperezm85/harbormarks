-- Per-user digest schedule (day + time). Idempotent; never drops user data.
-- Defaults preserve legacy behavior: Sunday (0) at 07:00 server-local time.
ALTER TABLE digest_preferences
  ADD COLUMN IF NOT EXISTS send_day INTEGER NOT NULL DEFAULT 0;
ALTER TABLE digest_preferences
  ADD COLUMN IF NOT EXISTS send_time TEXT NOT NULL DEFAULT '07:00';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_digest_preferences_send_day'
  ) THEN
    ALTER TABLE digest_preferences
      ADD CONSTRAINT chk_digest_preferences_send_day CHECK (send_day BETWEEN 0 AND 6);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_digest_preferences_send_time'
  ) THEN
    ALTER TABLE digest_preferences
      ADD CONSTRAINT chk_digest_preferences_send_time CHECK (send_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  END IF;
END $$;
