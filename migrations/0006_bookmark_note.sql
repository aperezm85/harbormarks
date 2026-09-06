-- Story 12: searchable user notes on bookmarks (notes-only slice).
-- Adds a nullable note column and rebuilds the search_vector generated column
-- so note text is indexed. Idempotent; never drops user data.
--
-- Explicitly OUT of scope: status/unread/reading/archived columns, sidebar
-- queues, is: operators, export/import changes.

ALTER TABLE bookmarks
  ADD COLUMN IF NOT EXISTS note TEXT;

-- Rebuild the generated column against the 5-argument search function.
DROP INDEX IF EXISTS idx_bookmarks_search_vector;

ALTER TABLE bookmarks
  DROP COLUMN IF EXISTS search_vector;

DROP FUNCTION IF EXISTS harbormarks_bookmark_search_text(TEXT, TEXT, TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION harbormarks_bookmark_search_text(
  bookmark_url TEXT,
  bookmark_title TEXT,
  bookmark_description TEXT,
  bookmark_tags TEXT[],
  bookmark_note TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $fn$
  SELECT coalesce(bookmark_url, '')
      || ' ' || coalesce(bookmark_title, '')
      || ' ' || coalesce(bookmark_description, '')
      || ' ' || coalesce(array_to_string(bookmark_tags, ' '), '')
      || ' ' || coalesce(bookmark_note, '');
$fn$;

ALTER TABLE bookmarks
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'simple',
      harbormarks_bookmark_search_text(url, title, description, tags, note)
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_bookmarks_search_vector
  ON bookmarks USING gin (search_vector);
