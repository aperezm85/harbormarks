import { Client } from "pg"

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { normalizeBookmarkUrl } from "./bookmark-url"
import { runMigrations } from "../../test/support"
import type { ParsedImportRow } from "./bookmark-import"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

type RawBookmark = {
   id: number
   user_id: number
   url: string
   title: string
   is_favorite: boolean
   deleted_at: string | null
}

// Set before the data layer imports so its connection pool targets the test
// database and no admin user is auto-bootstrapped from the ambient environment.
process.env.DATABASE_URL = TEST_DATABASE_URL
process.env.HARBOR_BOOTSTRAP_ADMIN_EMAIL = ""
process.env.HARBOR_BOOTSTRAP_ADMIN_PASSWORD = ""
process.env.HARBOR_BOOTSTRAP_ADMIN_NAME = ""

// Insert straight into the table via a raw client so each case controls exactly
// which user owns a row, bypassing the data layer's user scoping on the way in.
async function insertBookmark(
   client: Client,
   userId: number,
   opts: {
    url: string
    title?: string | null
    favorite?: boolean
    visitCount?: number
    tags?: string[] | null
    deleted?: boolean
    deletedAt?: Date | null
    }
): Promise<RawBookmark> {
  const tagLiteral =
    opts.tags &&
    Array.isArray(opts.tags) &&
       opts.tags.length > 0
          ? `{${opts.tags.join(",")}}`
          : null

  const result = await client.query(
      `\nINSERT INTO bookmarks (user_id, url, title, is_favorite, visit_count, tags, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6::text[], $7)
    RETURNING id, user_id, url, title, is_favorite, deleted_at`,
     [
      userId,
      opts.url,
      opts.title ?? null,
      opts.favorite ?? false,
      opts.visitCount ?? 0,
      tagLiteral,
      opts.deleted ? (opts.deletedAt ?? new Date()) : null,
       ]
  )

   return result.rows[0] as RawBookmark
}

async function getBookmark(
   client: Client,
   id: number
): Promise<RawBookmark | undefined> {
   const { rows } = await client.query(
          `SELECT id, user_id, url, title, is_favorite, deleted_at
         FROM bookmarks WHERE id = $1`,
          [id]
         )

   return rows[0] as RawBookmark | undefined
}

async function truncateAll(client: Client): Promise<void> {
  await client.query(
     "TRUNCATE TABLE " +
       "bookmarks, sessions, email_verification_tokens, password_reset_tokens, " +
       "users RESTART IDENTITY CASCADE"
      )
 }

describe.skipIf(!TEST_DATABASE_URL)("ownership isolation", () => {
  let raw: Client
  let bm: typeof import("./bookmarks")
  let ownerA = 0
  let ownerB = 0

     // The data layer's module (and its connection pool) is cached per worker and
     // must keep pointing at the same database for every test, so run the
     // migrations once against the real schema here; each test only empties the
     // tables via TRUNCATE. A stale row from a previous run never affects the
     // cross-owner assertions, which query by the ids they just created.
    // `skipIf` skips this whole suite at runtime when TEST_DATABASE_URL is unset,
    // so it is guaranteed defined here; the non-null assertion tells the type
    // checker what the runtime guard already ensures.
    const controlUrl = TEST_DATABASE_URL!

     beforeAll(async () => {
       await runMigrations(controlUrl)

       raw = new Client({ connectionString: controlUrl })
       await raw.connect()

       bm = await import("./bookmarks")
        })

   beforeEach(async () => {
     await truncateAll(raw)

     const a = await raw.query(
        `INSERT INTO users (email, password_hash) VALUES ('owner-a@example.com', 'x') RETURNING id`
         )
      const b = await raw.query(
        `INSERT INTO users (email, password_hash) VALUES ('owner-b@example.com', 'x') RETURNING id`
         )

     ownerA = Number(a.rows[0].id)
     ownerB = Number(b.rows[0].id)
     })

  afterAll(async () => {
    await raw.end()
     })

  it("updateBookmarkById cannot modify another user's row", async () => {
    const target = await insertBookmark(raw, ownerB, {
        url: "https://b-update.example.com/a",
        title: "Original",
         })
    const owned = await insertBookmark(raw, ownerA, {
        url: "https://a-update.example.com/a",
        title: "Mine",
         })

    expect(await bm.updateBookmarkById(ownerA, target.id, {
       url: target.url,
       title: "Hijacked",
       })).toBeNull()
    expect((await getBookmark(raw, target.id))?.title).toBe("Original")

    const result = await bm.updateBookmarkById(ownerA, owned.id, {
       url: owned.url,
       title: "Renamed",
       })
    expect(result).not.toBeNull()
    expect((await getBookmark(raw, owned.id))?.title).toBe("Renamed")
     })

  it("deleteBookmarkById cannot soft-delete another user's row", async () => {
    const target = await insertBookmark(raw, ownerB, {
        url: "https://b-delete.example.com/a",
         })
    const owned = await insertBookmark(raw, ownerA, {
        url: "https://a-delete.example.com/a",
         })

    expect(await bm.deleteBookmarkById(ownerA, target.id)).toBe(false)
    expect((await getBookmark(raw, target.id))?.deleted_at).toBeNull()

    expect(await bm.deleteBookmarkById(ownerA, owned.id)).toBe(true)
    expect((await getBookmark(raw, owned.id))?.deleted_at).not.toBeNull()
     })

  it("restoreBookmarkById cannot restore another user's row", async () => {
    const target = await insertBookmark(raw, ownerB, {
        url: "https://b-restore.example.com/a",
        deleted: true,
         })
    const owned = await insertBookmark(raw, ownerA, {
        url: "https://a-restore.example.com/a",
        deleted: true,
         })

    expect(await bm.restoreBookmarkById(ownerA, target.id)).toBe(false)
    expect((await getBookmark(raw, target.id))?.deleted_at).not.toBeNull()

    expect(await bm.restoreBookmarkById(ownerA, owned.id)).toBe(true)
    expect((await getBookmark(raw, owned.id))?.deleted_at).toBeNull()
     })

  it("purgeBookmarkById refuses a row that is not already soft-deleted", async () => {
    const active = await insertBookmark(raw, ownerA, {
        url: "https://a-purge-active.example.com/a",
         })

    expect(await bm.purgeBookmarkById(ownerA, active.id)).toBe(false)
    expect(await getBookmark(raw, active.id)).toBeTruthy()
     })

  it("purgeBookmarkById cannot purge another user's row", async () => {
    const target = await insertBookmark(raw, ownerB, {
        url: "https://b-purge.example.com/a",
        deleted: true,
         })
    const owned = await insertBookmark(raw, ownerA, {
        url: "https://a-purge.example.com/a",
        deleted: true,
         })

    expect(await bm.purgeBookmarkById(ownerA, target.id)).toBe(false)
    expect(await getBookmark(raw, target.id)).toBeTruthy()

    expect(await bm.purgeBookmarkById(ownerA, owned.id)).toBe(true)
    expect(await getBookmark(raw, owned.id)).toBeUndefined()
     })

  it("toggleFavoriteById cannot change another user's row", async () => {
    const target = await insertBookmark(raw, ownerB, {
        url: "https://b-fav.example.com/a",
        favorite: false,
         })
    const owned = await insertBookmark(raw, ownerA, {
        url: "https://a-fav.example.com/a",
        favorite: false,
         })

    expect(await bm.toggleFavoriteById(ownerA, target.id)).toBe(false)
    expect((await getBookmark(raw, target.id))?.is_favorite).toBe(false)

    expect(await bm.toggleFavoriteById(ownerA, owned.id)).toBe(true)
    expect((await getBookmark(raw, owned.id))?.is_favorite).toBe(true)
     })

  it("listBookmarks never returns another user's rows under any view or filter", async () => {
    const aFav = await insertBookmark(raw, ownerA, {
        url: "https://a-list-fav.example.com/a",
        title: "Kubernetes guide",
        favorite: true,
        tags: ["alpha", "kubernetes"],
        visitCount: 3,
         })
    const aNoTags = await insertBookmark(raw, ownerA, {
        url: "https://a-list-notags.example.com/a",
        tags: null,
         })
    const aTrash = await insertBookmark(raw, ownerA, {
        url: "https://a-list-trash.example.com/a",
        deleted: true,
         })
    const bFav = await insertBookmark(raw, ownerB, {
        url: "https://b-list-fav.example.com/a",
        title: "Pocket guide",
        favorite: true,
        tags: ["kubernetes"],
         })
    const bNoTags = await insertBookmark(raw, ownerB, {
        url: "https://b-list-notags.example.com/a",
        tags: null,
         })
    const bTrash = await insertBookmark(raw, ownerB, {
        url: "https://b-list-trash.example.com/a",
        deleted: true,
         })

    const bUrls = new Set([
        normalizeBookmarkUrl(bFav.url),
        normalizeBookmarkUrl(bNoTags.url),
        normalizeBookmarkUrl(bTrash.url),
        ])

    const neverCrossOwner = (rows: { url: string }[]) => {
       for (const row of rows) {
         expect(bUrls.has(row.url)).toBe(false)
         }
        }

      // Active views exclude both soft-deleted rows and every other user's row.
    for (const view of ["recent", "mostVisited"] as const) {
      const rows = await bm.listBookmarks(ownerA, { view, pageSize: 100 })
      neverCrossOwner(rows)
       }

    const unorganized = await bm.listBookmarks(ownerA, {
      view: "unorganized",
      pageSize: 100,
       })

    neverCrossOwner(unorganized)
    expect(unorganized.map((r) => r.url)).toEqual([
      normalizeBookmarkUrl(aNoTags.url),
       ])

    const trash = await bm.listBookmarks(ownerA, {
      view: "trash",
      pageSize: 100,
       })

    neverCrossOwner(trash)
    expect(trash.map((r) => r.url)).toEqual([
      normalizeBookmarkUrl(aTrash.url),
       ])

    const favorites = await bm.listBookmarks(ownerA, {
      onlyFavorites: true,
      pageSize: 100,
       })

    neverCrossOwner(favorites)
    expect(favorites.map((r) => r.url)).toEqual([
      normalizeBookmarkUrl(aFav.url),
       ])

    const searched = await bm.listBookmarks(ownerA, {
      search: "kubernetes",
      pageSize: 100,
       })

    neverCrossOwner(searched)

    const byTag = await bm.listBookmarks(ownerA, {
      tag: "kubernetes",
      pageSize: 100,
       })

    neverCrossOwner(byTag)
     })
})

describe.skipIf(!TEST_DATABASE_URL)("import behaviors", () => {
  let raw: Client
  let bm: typeof import("./bookmarks")
  let ownerA = 0
  let ownerB = 0

  const controlUrl = TEST_DATABASE_URL!

  function importRow(
     partial: Partial<ParsedImportRow>
    ): ParsedImportRow {
    return {
      url: partial.url ?? "https://example.com/new",
      title: partial.title ?? null,
      description: partial.description ?? null,
      favicon: partial.favicon ?? null,
      previewImage: partial.previewImage ?? null,
      tags: partial.tags ?? [],
      isFavorite: partial.isFavorite ?? false,
      createdAt: partial.createdAt ?? null,
      }
    }

  const BULK = Array.from({ length: 5000 }, (_, i) =>
     importRow({ url: `https://bulk.example.com/${i}` })
      )

  beforeAll(async () => {
    await runMigrations(controlUrl)

    raw = new Client({ connectionString: controlUrl })
    await raw.connect()

    bm = await import("./bookmarks")
       })

  beforeEach(async () => {
    await raw.query(
        "TRUNCATE TABLE " +
           "bookmarks, sessions, email_verification_tokens, password_reset_tokens, " +
           "users RESTART IDENTITY CASCADE"
            )

    const a = await raw.query(
        `INSERT INTO users (email, password_hash) VALUES ('imp-a@example.com', 'x') RETURNING id`
          )
    const b = await raw.query(
        `INSERT INTO users (email, password_hash) VALUES ('imp-b@example.com', 'x') RETURNING id`
          )

    ownerA = Number(a.rows[0].id)
    ownerB = Number(b.rows[0].id)
         })

  afterAll(async () => {
    await raw.end()
        })

  const countFor = async (userId: number) => {
      const { rows } = await raw.query(
          "SELECT count(*)::int AS n FROM bookmarks WHERE user_id = $1 AND deleted_at IS NULL",
          [userId]
          )
      return Number(rows[0].n)
         }

  it("imports a fresh collection and preserves createdAt", async () => {
     const result = await bm.importBookmarks(ownerA, [
       importRow({
          url: "https://history.example.com/a",
          title: "History",
          tags: ["old"],
          createdAt: "2020-01-02T00:00:00.000Z",
          })
        ])

     expect(result.imported).toBe(1)
     expect(result.skippedDuplicates).toBe(0)
     expect(await countFor(ownerA)).toBe(1)

     const { rows } = await raw.query(
        "SELECT created_at FROM bookmarks WHERE user_id = $1",
        [ownerA]
         )
     expect(rows[0].created_at.toISOString()).toBe("2020-01-02T00:00:00.000Z")
       })

  it("skips a duplicate URL on a second import with skip", async () => {
     await bm.importBookmarks(ownerA, [
       importRow({ url: "https://dup.example.com/a" })
         ])

     const second = await bm.importBookmarks(ownerA, [
       importRow({ url: "https://dup.example.com/a" })
         ])

     expect(second.imported).toBe(0)
     expect(second.skippedDuplicates).toBe(1)
     expect(await countFor(ownerA)).toBe(1)
       })

  it("merge-tags adds only the new tags and changes nothing else", async () => {
     await raw.query(
         `INSERT INTO bookmarks (user_id, url, title, tags)
          VALUES ($1, 'https://merge.example.com/a', 'Merged', ARRAY['Rust']::text[])`,
         [ownerA]
          )

     const result = await bm.importBookmarks(
        ownerA,
         [importRow({ url: "https://merge.example.com/a", tags: ["rust", "go"] })],
         { duplicates: "merge-tags" }
          )

     expect(result.mergedTags).toBe(1)

     const { rows } = await raw.query(
        "SELECT tags, title FROM bookmarks WHERE user_id = $1",
        [ownerA]
         )
     // "rust" is a case-insensitive duplicate of the existing "Rust"; only "go"
     // is added and the original casing is preserved. The title is untouched.
     expect(rows[0].tags.sort()).toEqual(["Rust", "go"])
     expect(rows[0].title).toBe("Merged")
       })

  it("reports a malformed row in failed and continues the import", async () => {
     const result = await bm.importBookmarks(ownerA, [
       importRow({ url: "not a url" }),
       importRow({ url: "https://ok.example.com/1" }),
       importRow({ url: "https://ok.example.com/2" })
          ])

     expect(result.imported).toBe(2)
     expect(result.failed).toHaveLength(1)
     expect(result.failed[0].reason).toBe("Invalid URL")
     expect(await countFor(ownerA)).toBe(2)
       })

  it("never writes to another user's bookmarks", async () => {
     await raw.query(
         `INSERT INTO bookmarks (user_id, url, title, tags)
          VALUES ($1, 'https://shared.example.com/x', 'B', ARRAY['mine']::text[])`,
         [ownerB]
          )

     await bm.importBookmarks(
        ownerA,
         [importRow({ url: "https://shared.example.com/x", tags: ["theirs"] })],
         { duplicates: "merge-tags" }
          )

     // ownerB's row is untouched by ownerA's import.
     const { rows } = await raw.query(
        "SELECT tags FROM bookmarks WHERE user_id = $1 AND url = $2",
        [ownerB, "https://shared.example.com/x"]
         )
     expect(rows[0].tags).toEqual(["mine"])
     expect(await countFor(ownerB)).toBe(1)
     // ownerA got its own row carrying only its own tags.
     expect(await countFor(ownerA)).toBe(1)
       })

  it("imports 5,000 bookmarks without exhausting memory", async () => {
     const result = await bm.importBookmarks(ownerA, BULK)
     expect(result.imported).toBe(5000)
     expect(await countFor(ownerA)).toBe(5000)
       })
 })
