-- Convert bookmark tags from TEXT (JSON/comma-separated) to TEXT[] array.
-- Drop the old column and recreate it as a TEXT[] array since existing data is denormalized.
ALTER TABLE bookmarks DROP COLUMN tags;

ALTER TABLE bookmarks ADD COLUMN tags TEXT[];

-- Drop the trigram index since tags is now an array.
DROP INDEX IF EXISTS idx_bookmarks_tags_trgm;