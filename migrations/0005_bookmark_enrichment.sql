-- Story 7: enrichment columns for bookmark metadata.
-- All columns are nullable, additive, and idempotent.
--
-- These fields are extracted from the target page's HTML metadata when a
-- bookmark is created or its metadata is fetched. They are additive:
-- existing rows are not backfilled. A card may have none, some, or all
-- of them populated.

-- No index is needed: these fields are not queried in any existing list
-- filter. If a future filter needs them, add an index there.

ALTER TABLE bookmarks
  ADD COLUMN IF NOT EXISTS site_name TEXT;

ALTER TABLE bookmarks
  ADD COLUMN IF NOT EXISTS author TEXT;

ALTER TABLE bookmarks
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;

ALTER TABLE bookmarks
  ADD COLUMN IF NOT EXISTS language TEXT;

ALTER TABLE bookmarks
  ADD COLUMN IF NOT EXISTS canonical_url TEXT;
