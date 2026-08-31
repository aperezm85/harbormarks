-- Give the bookmark search a real index.
--
-- listBookmarks() filtered and ranked on an inline
--   to_tsvector('simple', concat_ws(' ', url, title, description, array_to_string(tags,' ')))
-- expression. That can never use an index: concat_ws() and array_to_string() are
-- STABLE, not IMMUTABLE, so Postgres rejects the expression in an index or a
-- generated column and every search fell back to a sequential scan that rebuilt
-- the tsvector for every row.
--
-- The wrapper below is deterministic for a text[] with a constant separator, so
-- declaring it IMMUTABLE is sound and lets the column be generated and indexed.

CREATE OR REPLACE FUNCTION harbormarks_bookmark_search_text(
  bookmark_url TEXT,
  bookmark_title TEXT,
  bookmark_description TEXT,
  bookmark_tags TEXT[]
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $fn$
  SELECT coalesce(bookmark_url, '')
      || ' ' || coalesce(bookmark_title, '')
      || ' ' || coalesce(bookmark_description, '')
      || ' ' || coalesce(array_to_string(bookmark_tags, ' '), '');
$fn$;

ALTER TABLE bookmarks
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'simple',
      harbormarks_bookmark_search_text(url, title, description, tags)
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_bookmarks_search_vector
  ON bookmarks USING gin (search_vector);

-- The trigram indexes existed only for the old ILIKE '%q%' search. Nothing queries
-- them now, and three GIN indexes are not free on every write.
DROP INDEX IF EXISTS idx_bookmarks_url_trgm;
DROP INDEX IF EXISTS idx_bookmarks_title_trgm;
DROP INDEX IF EXISTS idx_bookmarks_description_trgm;
