-- Convert bookmark tags from TEXT (JSON array or comma-separated) to TEXT[].
--
-- This migration must stay data-preserving: environments whose bookmarks table was
-- created by the pre-migration runtime bootstrap still hold real tag data in a
-- scalar TEXT column, and they apply this file for the first time. It is also
-- idempotent, so it is a no-op where tags is already TEXT[].

CREATE OR REPLACE FUNCTION pg_temp.harbormarks_parse_tags(raw TEXT)
RETURNS TEXT[] AS $fn$
DECLARE
  parsed TEXT[];
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN NULL;
  END IF;

  -- Mirrors parseTags() in src/lib/bookmarks.ts: JSON array first, then CSV.
  IF btrim(raw) LIKE '[%' THEN
    BEGIN
      SELECT array_agg(btrim(value) ORDER BY ord)
        INTO parsed
        FROM jsonb_array_elements_text(btrim(raw)::jsonb)
             WITH ORDINALITY AS elements(value, ord)
       WHERE btrim(value) <> '';

      RETURN parsed;
    EXCEPTION
      WHEN others THEN
        -- Malformed JSON: fall through to comma-separated parsing.
    END;
  END IF;

  SELECT array_agg(btrim(part) ORDER BY ord)
    INTO parsed
    FROM unnest(string_to_array(raw, ',')) WITH ORDINALITY AS parts(part, ord)
   WHERE btrim(part) <> '';

  RETURN parsed;
END;
$fn$ LANGUAGE plpgsql;

DO $migrate$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'bookmarks'
       AND column_name = 'tags'
       AND data_type <> 'ARRAY'
  ) THEN
    ALTER TABLE bookmarks ADD COLUMN tags_converted TEXT[];

    UPDATE bookmarks
       SET tags_converted = pg_temp.harbormarks_parse_tags(tags);

    ALTER TABLE bookmarks DROP COLUMN tags;
    ALTER TABLE bookmarks RENAME COLUMN tags_converted TO tags;
  END IF;
END
$migrate$;

-- The trigram index only made sense while tags was scalar TEXT.
DROP INDEX IF EXISTS idx_bookmarks_tags_trgm;
