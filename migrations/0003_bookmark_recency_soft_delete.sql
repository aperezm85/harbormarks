ALTER TABLE bookmarks
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE bookmarks
  ADD COLUMN IF NOT EXISTS last_visited_at TIMESTAMP;

ALTER TABLE bookmarks
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_updated_at
  ON bookmarks(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_deleted_at
  ON bookmarks(user_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_last_visited_at
  ON bookmarks(user_id, last_visited_at DESC);
