import { Client } from "pg"

import { describe, expect, it } from "vitest"

import { runMigrations, withIsolatedDatabase } from "../test/support"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

describe.skipIf(!TEST_DATABASE_URL)(
  "migration round-trip",
  () => {
   async function assertFinalSchema(
     url: string
   ): Promise<void> {
     const client = new Client({ connectionString: url })
     await client.connect()
     try {
        const columnsResult = await client.query(
             `SELECT column_name, data_type, udt_name
               FROM information_schema.columns
              WHERE table_schema = 'public'
                AND table_name = 'bookmarks'
              ORDER BY ordinal_position`
             )
            .then((r) => r.rows)

       const columnNames = columnsResult.map((row) => row.column_name)

       for (const expected of [
             "id",
             "user_id",
             "url",
             "title",
             "description",
             "favicon",
             "preview_image",
             "is_favorite",
             "visit_count",
             "tags",
             "created_at",
             "updated_at",
             "last_visited_at",
             "deleted_at",
             "search_vector",
           ]) {
           expect(columnNames).toContain(expected)
          }

        const tagsType = columnsResult.find(
            (row) => row.column_name === "tags"
            )
        expect(tagsType?.udt_name).toBe("_text")

        const generated = await client.query(
            `SELECT attgenerated
              FROM pg_attribute
             WHERE attrelid = 'public.bookmarks'::regclass
               AND attname = 'search_vector'`
             )
            .then((r) => r.rows[0])
           // 's' = stored generated column.
          expect(generated?.attgenerated).toBe("s")

        const indexExists = await client.query(
            `SELECT 1
              FROM pg_indexes
             WHERE indexname = 'idx_bookmarks_search_vector'`
             )
            .then((r) => r.rowCount)
          expect(indexExists).toBe(1)
       } finally {
        await client.end()
       }
   }

   // The pre-migration runtime bootstrap shaped bookmarks tags as scalar TEXT and
   // without recency/soft-delete columns. This is the shape that applies 0002 for
   // the first time.
   async function createLegacySchema(url: string): Promise<void> {
     const client = new Client({ connectionString: url })
     await client.connect()
     try {
        await client.query(
             `CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL
               )`
             )

        await client.query(
             `CREATE TABLE bookmarks (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                url TEXT NOT NULL,
                title TEXT,
                description TEXT,
                preview_image TEXT,
                is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
                visit_count INTEGER NOT NULL DEFAULT 0,
                tags TEXT,
                created_at TIMESTAMP DEFAULT NOW()
               )`
             )

        await client.query(
            `INSERT INTO users (email, password_hash)
               VALUES ('owner@example.com', 'x')
             RETURNING id`
             )

        // A JSON-array string, a comma-separated string, and a NULL must all
        // survive 0002 as the right arrays. The destructive DROP COLUMN version
        // of 0002 would abandon all three.
        await client.query(
             `INSERT INTO bookmarks (user_id, url, tags)
               VALUES (1, 'https://json.example.com', '["alpha","beta"]')`
             )

        await client.query(
             `INSERT INTO bookmarks (user_id, url, tags)
               VALUES (1, 'https://csv.example.com', 'gamma, delta')`
             )

        await client.query(
             `INSERT INTO bookmarks (user_id, url, tags)
               VALUES (1, 'https://null.example.com', NULL)`
             )
       } finally {
        await client.end()
       }
   }

   async function readTags(
     url: string
    ): Promise<Array<string[] | null>> {
     const client = new Client({ connectionString: url })
     await client.connect()
     try {
        const result = await client.query(
             `SELECT tags
               FROM bookmarks
              ORDER BY id`
            )

       return result.rows.map((row) => row.tags)
      } finally {
       await client.end()
      }
   }

   it("applies cleanly onto a fresh database", async () => {
     await withIsolatedDatabase("harbor_test_fresh", async (url) => {
       await runMigrations(url)
        await assertFinalSchema(url)
       })
    })

   it("preserves scalar-tag data when upgrading a legacy database", async () => {
      await withIsolatedDatabase("harbor_test_upgrade", async (url) => {
        await createLegacySchema(url)
        await runMigrations(url)

        const tags = await readTags(url)

        expect(tags).toEqual([
            ["alpha", "beta"],
            ["gamma", "delta"],
            null,
            ])
        })
     })

   it("is a no-op when the full chain is applied twice", async () => {
        await withIsolatedDatabase("harbor_test_idempotent", async (url) => {
          await runMigrations(url)

          const client = new Client({ connectionString: url })
          await client.connect()

          try {
            const afterFirst = Number(
                await client.query("SELECT count(*)::int FROM schema_migrations")
                       .then((r) => r.rows[0].count)
                )

            await runMigrations(url)

            const afterSecond = Number(
                await client.query("SELECT count(*)::int FROM schema_migrations")
                       .then((r) => r.rows[0].count)
                )

            expect(afterFirst).toBeGreaterThan(0)
             expect(afterSecond).toBe(afterFirst)
            } finally {
            await client.end()
            }
           })
          })
})
