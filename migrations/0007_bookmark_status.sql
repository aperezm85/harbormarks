-- Bookmark read status (unread slice): adds a status column defaulting to
-- 'unread' so existing rows keep their implicit state. Idempotent; never drops
-- user data. Never edit older migrations.
ALTER TABLE bookmarks
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'unread';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_bookmarks_status'
  ) THEN
    ALTER TABLE bookmarks
      ADD CONSTRAINT chk_bookmarks_status CHECK (status IN ('unread', 'reading', 'archived'));
  END IF;
END $$;
