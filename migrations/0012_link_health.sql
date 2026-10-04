-- Story 14: link health tracking (broken link monitoring)
--
-- Adds a `link_health` column (orthogonal to the existing `status` column)
-- so bookmarks can be both "unread" and "broken" at the same time.

ALTER TABLE bookmarks
  ADD COLUMN link_health TEXT NOT NULL DEFAULT 'unknown'
    CHECK (link_health IN ('unknown', 'checking', 'ok', 'broken'));

CREATE INDEX idx_bookmarks_link_health
  ON bookmarks (link_health)
  WHERE link_health != 'unknown' AND deleted_at IS NULL;
