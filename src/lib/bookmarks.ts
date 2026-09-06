import { and, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm"

import { db } from "@/db/client"
import { bookmarks } from "@/db/schema"
import { ensureAuthSchema } from "@/lib/auth"
import { normalizeBookmarkAssetUrl } from "@/lib/bookmark-assets"
import { normalizeTags, parseTags } from "@/lib/bookmark-tags"
import { parseBookmarkQuery } from "@/lib/bookmark-query"
import {
  type BookmarkCardData,
  type BookmarkStatus,
  type BookmarkTagSummary,
  type BookmarkView,
  type BookmarkViewCounts,
  DEFAULT_BOOKMARK_PAGE_SIZE,
} from "@/lib/bookmark-types"
import {
  type BookmarkExportRow,
  decodeAssetUrl,
} from "@/lib/bookmark-export"
import { normalizeBookmarkUrl } from "@/lib/bookmark-url"
import {
  type ParsedImportRow,
  type DuplicateStrategy,
  type ImportFailure,
} from "@/lib/bookmark-import"

export { DEFAULT_BOOKMARK_PAGE_SIZE }
export type {
  BookmarkCardData,
  BookmarkTagSummary,
  BookmarkView,
  BookmarkViewCounts,
}
// Maintained by Postgres as a STORED generated column and backed by a GIN index
// (migrations/0004_bookmark_search_vector.sql). Computing the tsvector inline here
// instead would force a sequential scan on every search: the concat_ws() and
// array_to_string() calls it needs are STABLE, so the expression cannot be indexed.
const BOOKMARK_SEARCH_VECTOR = sql`bookmarks.search_vector`

const DEFAULT_FAVICON = "/favicon.ico"

const BOOKMARK_STATUSES: readonly BookmarkStatus[] = [
  "unread",
  "reading",
  "archived",
]

export function isBookmarkStatus(value: unknown): value is BookmarkStatus {
  return (
    typeof value === "string" &&
    (BOOKMARK_STATUSES as readonly string[]).includes(value)
  )
}

function normalizeBookmarkStatus(value: unknown): BookmarkStatus {
  return isBookmarkStatus(value) ? value : "unread"
}

let isSchemaReady = false
let schemaReadyPromise: Promise<void> | null = null

async function ensureBookmarksTable() {
  if (isSchemaReady) {
    return
  }

  if (schemaReadyPromise) {
    await schemaReadyPromise
    return
  }

  schemaReadyPromise = (async () => {
    try {
      await ensureAuthSchema()

      isSchemaReady = true
    } finally {
      schemaReadyPromise = null
    }
  })()

  await schemaReadyPromise
}

function toCardData(bookmark: typeof bookmarks.$inferSelect): BookmarkCardData {
  return {
    id: String(bookmark.id),
    url: bookmark.url,
    title: bookmark.title ?? bookmark.url,
    description: bookmark.description ?? "No description yet.",
    favicon:
      normalizeBookmarkAssetUrl(bookmark.favicon ?? DEFAULT_FAVICON) ??
      DEFAULT_FAVICON,
    previewImage: normalizeBookmarkAssetUrl(bookmark.previewImage),
    tags: parseTags(bookmark.tags),
    createdAt: bookmark.createdAt
      ? bookmark.createdAt.toISOString()
      : new Date().toISOString(),
    updatedAt: bookmark.updatedAt ? bookmark.updatedAt.toISOString() : null,
    lastVisitedAt: bookmark.lastVisitedAt
       ? bookmark.lastVisitedAt.toISOString()
       : null,
    isFavorite: bookmark.isFavorite,
    visitCount: bookmark.visitCount,
    // Story 7 enrichments: carried through verbatim. publishedAt is a DB
    // timestamp, so it is normalized to an ISO string like the other timestamps;
    // the remaining four are plain text and pass through as-is.
    siteName: bookmark.siteName,
    author: bookmark.author,
    publishedAt: bookmark.publishedAt
       ? bookmark.publishedAt.toISOString()
       : null,
    language: bookmark.language,
    canonicalUrl: bookmark.canonicalUrl,
    // Story 12 notes-only slice: private user note, null when unset.
    note: bookmark.note ?? null,
    // Read status slice: unexpected values fall back to unread so the card
    // never renders a broken state (e.g. rows written before the constraint).
    status: normalizeBookmarkStatus(
      (bookmark as { status?: unknown }).status
    ),
   }
 }

async function findBookmarkByCanonicalUrl(
  userId: number,
  url: string,
  excludedBookmarkId?: number
) {
  const normalizedUrl = normalizeBookmarkUrl(url)

  if (!normalizedUrl) {
    return null
  }

  const rows = await db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId))

  return (
    rows.find((bookmark) => {
      if (excludedBookmarkId && bookmark.id === excludedBookmarkId) {
        return false
      }

      if (bookmark.deletedAt) {
        return false
      }

      return normalizeBookmarkUrl(bookmark.url) === normalizedUrl
    }) ?? null
  )
}

export async function hasDuplicateBookmarkUrl(
  userId: number,
  url: string,
  excludedBookmarkId?: number
) {
  await ensureBookmarksTable()

  return (
    (await findBookmarkByCanonicalUrl(userId, url, excludedBookmarkId)) !== null
  )
}

export async function findDuplicateBookmark(
  userId: number,
  url: string,
  excludedBookmarkId?: number
) {
  await ensureBookmarksTable()

  const row = await findBookmarkByCanonicalUrl(
    userId,
    url,
    excludedBookmarkId
  )

  return row ? toCardData(row) : null
}

export async function listBookmarks(
  userId: number,
  options?: {
    search?: string
    onlyFavorites?: boolean
    view?: BookmarkView
    tag?: string
    page?: number
    pageSize?: number
  }
) {
  await ensureBookmarksTable()

  const tag = options?.tag?.trim()
  const filters = []
  // Story 8: the raw `q` string is parsed into operators plus free text. The
  // parser is pure and unit-tested; the SQL below is built from that structured
  // object with parameter binding, never from interpolated text.
  const parsedQuery = options?.search
    ? parseBookmarkQuery(options.search)
    : { freeText: "", operators: [] }
  const freeText = parsedQuery.freeText
  // Ranking (ts_rank) applies only when free text is present, so an
  // operators-only query keeps the view's default sort order.
  const searchQuery = freeText
    ? sql`websearch_to_tsquery('simple', ${freeText})`
    : null
  const viewSort =
    options?.view === "mostVisited"
      ? desc(
          sql<number>`
            ${bookmarks.visitCount} * exp(
              -extract(epoch from (now() - coalesce(${bookmarks.lastVisitedAt}, ${bookmarks.createdAt}))) / 2592000.0
            )
          `
        )
      : options?.view === "trash"
        ? desc(bookmarks.deletedAt)
        : desc(sql`coalesce(${bookmarks.updatedAt}, ${bookmarks.createdAt})`)
  const viewSecondarySort =
    options?.view === "mostVisited"
      ? desc(bookmarks.visitCount)
      : options?.view === "trash"
        ? desc(sql`coalesce(${bookmarks.updatedAt}, ${bookmarks.createdAt})`)
        : desc(sql`coalesce(${bookmarks.updatedAt}, ${bookmarks.createdAt})`)
  const orderByClauses = searchQuery
    ? [
        desc(sql<number>`ts_rank(${BOOKMARK_SEARCH_VECTOR}, ${searchQuery})`),
        viewSort,
        viewSecondarySort,
        desc(bookmarks.createdAt),
      ]
    : [viewSort, viewSecondarySort, desc(bookmarks.createdAt)]

  filters.push(eq(bookmarks.userId, userId))

  if (options?.view === "trash") {
    filters.push(sql<boolean>`${bookmarks.deletedAt} is not null`)
  } else {
    filters.push(isNull(bookmarks.deletedAt))
  }

  if (options?.onlyFavorites) {
    filters.push(eq(bookmarks.isFavorite, true))
  }

  if (searchQuery) {
    filters.push(sql<boolean>`${BOOKMARK_SEARCH_VECTOR} @@ ${searchQuery}`)
  }

  // Story 8 operators. Pushed to the same `filters` array as the user and
  // soft-delete scoping, so every operator inherits that scoping and the
  // operators AND together. Each value is parameter-bound, never interpolated.
  for (const op of parsedQuery.operators) {
    switch (op.kind) {
      case "tag": {
        filters.push(
          sql<boolean>`exists (
            select 1
            from unnest(coalesce(${bookmarks.tags}, ARRAY[]::text[])) as bookmark_tag
            where lower(bookmark_tag) = ${op.value.toLowerCase()}
          )`
        )
        break
      }
      case "site": {
        const siteValue = op.value.toLowerCase()
        // The host is extracted from the stored URL. Matching is exact-host OR
        // subdomain; the `%.` prefix keeps `notgithub.com` and
        // `github.com.evil.com` from matching `site:github.com`.
        const host = sql`lower(coalesce(
          (regexp_match(${bookmarks.url}, '^[a-z][a-z0-9+.-]*://([^/:?#]+)'))[1],
          ''
        ))`
        filters.push(
          sql<boolean>`${host} = ${siteValue} or ${host} like ${`%.${siteValue}`}`
        )
        break
      }
      case "is": {
        if (op.value === "favorite") {
          filters.push(eq(bookmarks.isFavorite, true))
        } else if (
          op.value === "unread" ||
          op.value === "reading" ||
          op.value === "archived"
        ) {
          filters.push(eq(bookmarks.status, op.value))
        }
        break
      }
      case "has": {
        if (op.value === "image") {
          filters.push(isNotNull(bookmarks.previewImage))
        }
        break
      }
      case "before": {
        // `created_at` is `timestamp without time zone` and the session timezone
        // is UTC, so binding the JS Date (midnight UTC) matches how rows are
        // written.
        filters.push(sql<boolean>`${bookmarks.createdAt} < ${op.value}`)
        break
      }
      case "after": {
        filters.push(sql<boolean>`${bookmarks.createdAt} >= ${op.value}`)
        break
      }
    }
  }

  if (tag) {
    filters.push(sql<boolean>`exists (
      select 1
      from unnest(coalesce(${bookmarks.tags}, ARRAY[]::text[])) as bookmark_tag
      where lower(bookmark_tag) = lower(${tag})
    )`)
  }

  if (options?.view === "unorganized") {
    filters.push(
      or(isNull(bookmarks.tags), sql<boolean>`${bookmarks.tags} = '{}'::text[]`)
    )
  }

  if (options?.view === "unread") {
    filters.push(eq(bookmarks.status, "unread"))
  }

  const whereClause = filters.length === 1 ? filters[0] : and(...filters)
  const pageSize = Math.max(
    1,
    Math.min(options?.pageSize ?? DEFAULT_BOOKMARK_PAGE_SIZE, 100)
  )
  const page = Math.max(1, options?.page ?? 1)
  const offset = (page - 1) * pageSize

  const rows = await db
    .select()
    .from(bookmarks)
    .where(whereClause)
    .orderBy(...orderByClauses)
    .limit(pageSize)
    .offset(offset)

  return rows.map(toCardData)
}

export async function listBookmarkTags(userId: number, query?: string) {
  await ensureBookmarksTable()

  const normalizedQuery = query?.trim().toLowerCase()
  const queryFilter = normalizedQuery
    ? sql` and lower(tag) like ${`%${normalizedQuery}%`}`
    : sql``

  const result = await db.execute(sql<{
    tag: string
    count: number
  }>`
    select tag, count(*)::int as count
    from bookmarks
    cross join lateral unnest(coalesce(bookmarks.tags, ARRAY[]::text[])) as tag
    where bookmarks.user_id = ${userId}
      and bookmarks.deleted_at is null
    ${queryFilter}
    group by tag
    order by count desc, tag asc
  `)

  return result.rows.map((row) => ({
    tag: row.tag,
    count: Number(row.count),
  }))
}

function matchesTag(tag: string, target: string) {
  return tag.toLowerCase() === target.toLowerCase()
}

function dedupeTags(tags: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const tag of tags) {
    const key = tag.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      out.push(tag)
    }
  }
  return out
}

async function rewriteUserTags(
  userId: number,
  rewrite: (tags: string[]) => string[] | null
) {
  await ensureBookmarksTable()

  const rows = await db
    .select({ id: bookmarks.id, tags: bookmarks.tags })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), isNull(bookmarks.deletedAt)))

  let updated = 0
  for (const row of rows) {
    const current = parseTags(row.tags)
    const next = rewrite(current)
    if (next === null) {
      continue
    }
    await db
      .update(bookmarks)
      .set({ tags: next.length > 0 ? next : null, updatedAt: new Date() })
      .where(and(eq(bookmarks.id, row.id), eq(bookmarks.userId, userId)))
    updated += 1
  }
  return updated
}

export async function renameBookmarkTag(
  userId: number,
  from: string,
  to: string
) {
  const source = from.trim()
  const target = to.trim()
  if (!source || !target || matchesTag(source, target)) {
    throw new Error("Invalid tag rename")
  }

  return rewriteUserTags(userId, (tags) => {
    if (!tags.some((tag) => matchesTag(tag, source))) {
      return null
    }
    return dedupeTags(
      tags.map((tag) => (matchesTag(tag, source) ? target : tag))
    )
  })
}

export async function mergeBookmarkTags(
  userId: number,
  source: string,
  target: string
) {
  const from = source.trim()
  const to = target.trim()
  if (!from || !to || matchesTag(from, to)) {
    throw new Error("Invalid tag merge")
  }

  return rewriteUserTags(userId, (tags) => {
    if (!tags.some((tag) => matchesTag(tag, from))) {
      return null
    }
    const withoutSource = tags.filter((tag) => !matchesTag(tag, from))
    if (!withoutSource.some((tag) => matchesTag(tag, to))) {
      withoutSource.push(to)
    }
    return dedupeTags(withoutSource)
  })
}

export async function deleteBookmarkTag(userId: number, tag: string) {
  const target = tag.trim()
  if (!target) {
    throw new Error("Invalid tag")
  }

  return rewriteUserTags(userId, (tags) => {
    if (!tags.some((t) => matchesTag(t, target))) {
      return null
    }
    return tags.filter((t) => !matchesTag(t, target))
  })
}

// Per-view totals for the subbar chips. A single conditional-aggregation query
// keeps this to one indexed scan of the user's rows instead of one count per
// chip. `mostVisited` shares the `recent` set (it is the same rows, a different
// sort), so both report the non-deleted total.
export async function countBookmarksByView(
  userId: number
): Promise<BookmarkViewCounts> {
  await ensureBookmarksTable()

  const result = await db.execute(sql<{
    recent: number
    favorites: number
    unorganized: number
    trash: number
    unread: number
  }>`
    select
      count(*) filter (where deleted_at is null)::int as recent,
      count(*) filter (where deleted_at is null and is_favorite)::int as favorites,
      count(*) filter (
        where deleted_at is null and (tags is null or tags = '{}'::text[])
      )::int as unorganized,
      count(*) filter (where deleted_at is not null)::int as trash,
      count(*) filter (where deleted_at is null and status = 'unread')::int as unread
    from bookmarks
    where user_id = ${userId}
  `)

  const row = result.rows[0]

  return {
    recent: Number(row?.recent ?? 0),
    mostVisited: Number(row?.recent ?? 0),
    unorganized: Number(row?.unorganized ?? 0),
    favorites: Number(row?.favorites ?? 0),
    trash: Number(row?.trash ?? 0),
    unread: Number(row?.unread ?? 0),
  }
}

// `published_at` is a timestamp column, but the JSON API and the metadata
// extractor hand it over as a date string (and an export round-trip also keeps it
// as a string, per the Story 4 lossless contract). Parse it back to a Date; an
// empty or unparseable value stays null rather than a broken instant.
function parseEnrichmentDate(
  value: string | null | undefined
): Date | null {
  const raw = value?.trim()

  if (!raw) {
    return null
   }

  const time = Date.parse(raw)
  return Number.isNaN(time) ? null : new Date(time)
   }

export async function createBookmark(
   userId: number,
   input: {
     url: string
    title?: string | null
    description?: string | null
    favicon?: string | null
    previewImage?: string | null
    tags?: string[] | string | null
    isFavorite?: boolean
    // Story 7 enrichments. Optional on input and nullable on the columns:
    // written per call, never backfilled onto existing rows.
    siteName?: string | null
    author?: string | null
    publishedAt?: string | null
    language?: string | null
    canonicalUrl?: string | null
    // Story 12 notes-only slice: optional on input, nullable column.
    note?: string | null
    // Read status slice: optional on input, defaults to unread.
    status?: BookmarkStatus | string | null
    }
  ) {
    await ensureBookmarksTable()

    const normalizedUrl = normalizeBookmarkUrl(input.url)

    if (!normalizedUrl) {
      throw new Error("Invalid bookmark URL")
    }

    const status = normalizeBookmarkStatus(input.status ?? "unread")

    if (input.status != null && !isBookmarkStatus(input.status)) {
      throw new Error("Invalid bookmark status")
    }

    const [created] = await db
      .insert(bookmarks)
      .values({
        userId,
        url: normalizedUrl,
        title: input.title?.trim() || null,
        description: input.description?.trim() || null,
        favicon: normalizeBookmarkAssetUrl(input.favicon?.trim() || null),
        previewImage: normalizeBookmarkAssetUrl(
          input.previewImage?.trim() || null
        ),
        tags: normalizeTags(input.tags),
        isFavorite: input.isFavorite ?? false,
         // Each enrichment is trimmed like title/description: empty collapses to
         // null so a "not populated" field is stored as NULL, not an empty string.
         // publishedAt is a timestamp column, so the incoming date string is
         // parsed back to a Date like exported values are.
         siteName: input.siteName?.trim() || null,
         author: input.author?.trim() || null,
         publishedAt: parseEnrichmentDate(input.publishedAt),
         language: input.language?.trim() || null,
         canonicalUrl: input.canonicalUrl?.trim() || null,
          // Story 12 note: trimmed like title/description; empty collapses to
          // null so "no note" is stored as NULL, not an empty string.
          note: input.note?.trim() || null,
          status,
        updatedAt: new Date(),
      })
      .returning()

   return toCardData(created)
  }

export async function updateBookmarkById(
  userId: number,
  id: number,
  input: {
    url: string
    title?: string | null
    description?: string | null
    favicon?: string | null
    previewImage?: string | null
    tags?: string[] | string | null
    // Story 7 enrichments. Optional on input: the JSON route passes real values,
    // the form route passes `undefined`, which leaves the column untouched.
    siteName?: string | null
    author?: string | null
    publishedAt?: string | null
    language?: string | null
    canonicalUrl?: string | null
    // Story 12 note. Optional on input: the JSON route passes real values,
    // the form route passes `undefined`, which leaves the column untouched.
    note?: string | null | undefined
    // Read status slice. Optional on input: undefined omits the column;
    // a provided value is validated against the three allowed states.
    status?: BookmarkStatus | string | null | undefined
    // Favorite toggle. Optional on input: undefined omits the column so the
    // edit dialog can persist the switch in the same save as status.
    isFavorite?: boolean | undefined
    }
  ) {
   await ensureBookmarksTable()

   const normalizedUrl = normalizeBookmarkUrl(input.url)

   if (!normalizedUrl) {
    return null
    }

    // The enrichment fields are only written when the caller passed a value. The
    // JSON route always passes them; the form route passes `undefined`, so the
    // conditional spreads omit the column entirely and leave the stored value in
    // place. The form branch therefore keeps its current behavior byte-for-byte,
    // while the JSON branch overwrites with the submitted values (empty string
    // collapses to NULL via trim, just like title and description).
    const enrichment: {
     siteName?: string | null
     author?: string | null
     publishedAt?: Date | null
     language?: string | null
     canonicalUrl?: string | null
        } = {
       siteName:
         input.siteName !== undefined ? input.siteName?.trim() || null : undefined,
       author:
         input.author !== undefined ? input.author?.trim() || null : undefined,
       publishedAt:
         input.publishedAt !== undefined
               ? parseEnrichmentDate(input.publishedAt)
               : undefined,
       language:
         input.language !== undefined
               ? input.language?.trim() || null
               : undefined,
       canonicalUrl:
         input.canonicalUrl !== undefined
               ? input.canonicalUrl?.trim() || null
               : undefined,
         }
    // Story 12 note: only written when the caller passed a value. undefined
    // omits the column; null/string overwrites (empty collapses to NULL).
    const noteUpdate =
      input.note !== undefined ? { note: input.note?.trim() || null } : {}
    // Read status slice: only written when the caller passed a value.
    // undefined omits the column; null falls back to unread.
    if (input.status !== undefined && input.status !== null && !isBookmarkStatus(input.status)) {
      throw new Error("Invalid bookmark status")
    }
    const statusUpdate =
      input.status !== undefined
        ? { status: normalizeBookmarkStatus(input.status ?? "unread") }
        : {}
    const favoriteUpdate =
      input.isFavorite !== undefined ? { isFavorite: input.isFavorite } : {}

   const [updated] = await db
      .update(bookmarks)
      .set({
       url: normalizedUrl,
       title: input.title?.trim() || null,
       description: input.description?.trim() || null,
       favicon: normalizeBookmarkAssetUrl(input.favicon?.trim() || null),
       previewImage: normalizeBookmarkAssetUrl(
         input.previewImage?.trim() || null
        ),
        tags: normalizeTags(input.tags),
        ...enrichment,
        ...noteUpdate,
        ...statusUpdate,
        ...favoriteUpdate,
        updatedAt: new Date(),
       })
      .where(
       and(
         eq(bookmarks.id, id),
         eq(bookmarks.userId, userId),
         isNull(bookmarks.deletedAt)
        )
      )
      .returning()

   return updated ? toCardData(updated) : null
   }

export async function toggleFavoriteById(userId: number, id: number) {
  await ensureBookmarksTable()

  const [existing] = await db
    .select({ isFavorite: bookmarks.isFavorite })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.id, id),
        eq(bookmarks.userId, userId),
        isNull(bookmarks.deletedAt)
      )
    )
    .limit(1)

  if (!existing) {
    return false
  }

  await db
    .update(bookmarks)
    .set({ isFavorite: !existing.isFavorite, updatedAt: new Date() })
    .where(
      and(
        eq(bookmarks.id, id),
        eq(bookmarks.userId, userId),
        isNull(bookmarks.deletedAt)
      )
    )

  return true
}

export async function setBookmarkStatusById(
  userId: number,
  id: number,
  status: BookmarkStatus | string
) {
  await ensureBookmarksTable()

  if (!isBookmarkStatus(status)) {
    throw new Error("Invalid bookmark status")
  }

  const [updated] = await db
    .update(bookmarks)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(bookmarks.id, id),
        eq(bookmarks.userId, userId),
        isNull(bookmarks.deletedAt)
      )
    )
    .returning()

  return updated ? toCardData(updated) : null
}

export async function deleteBookmarkById(userId: number, id: number) {
  await ensureBookmarksTable()

  const deleted = await db
    .update(bookmarks)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(bookmarks.id, id),
        eq(bookmarks.userId, userId),
        isNull(bookmarks.deletedAt)
      )
    )
    .returning({ id: bookmarks.id })

  return deleted.length > 0
}

// Permanent removal is deliberately restricted to bookmarks that are already in
// Trash: a bookmark can only be destroyed by a second, explicit decision.
export async function purgeBookmarkById(userId: number, id: number) {
  await ensureBookmarksTable()

  const purged = await db
    .delete(bookmarks)
    .where(
      and(
        eq(bookmarks.id, id),
        eq(bookmarks.userId, userId),
        sql`${bookmarks.deletedAt} is not null`
      )
    )
    .returning({ id: bookmarks.id })

  return purged.length > 0
}

export async function restoreBookmarkById(userId: number, id: number) {
  await ensureBookmarksTable()

  const restored = await db
    .update(bookmarks)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(bookmarks.id, id),
        eq(bookmarks.userId, userId),
        sql`${bookmarks.deletedAt} is not null`
      )
    )
    .returning({ id: bookmarks.id })

  return restored.length > 0
}

export async function incrementBookmarkVisitById(userId: number, id: number) {
  await ensureBookmarksTable()

  const updated = await db
    .update(bookmarks)
    .set({
      visitCount: sql`${bookmarks.visitCount} + 1`,
      lastVisitedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bookmarks.id, id),
        eq(bookmarks.userId, userId),
        isNull(bookmarks.deletedAt)
      )
    )
    .returning({ id: bookmarks.id })

  return updated.length > 0
}

export async function resetBookmarkVisitCountById(userId: number, id: number) {
  await ensureBookmarksTable()

  const updated = await db
    .update(bookmarks)
    .set({ visitCount: 0, updatedAt: new Date() })
    .where(
       and(
         eq(bookmarks.id, id),
         eq(bookmarks.userId, userId),
         isNull(bookmarks.deletedAt)
        )
      )
      .returning({ id: bookmarks.id })

  return updated.length > 0
 }

// Reads an incoming asset value for import. A foreign file never carries the
// proxy form, so this just normalizes to the local proxy, matching createBookmark.
function incomingAsset(value: string | null): string | null {
  return normalizeBookmarkAssetUrl(value?.trim() || null)
}

// Case-insensitive tag union that preserves the casing of an already-present tag,
// so "rust" + "Rust" collapses to a single "Rust" rather than two copies.
function unionTags(existingTags: string[], incomingTags: string[]): string[] {
  const merged: string[] = []
  const seen = new Set<string>()

  for (const tag of [...existingTags, ...incomingTags]) {
    const trimmed = tag.trim()

    if (!trimmed) {
      continue
     }

    const lower = trimmed.toLowerCase()

    if (!seen.has(lower)) {
      seen.add(lower)
      merged.push(trimmed)
     }
   }

  return merged
}

// Are two tag sets different, case-insensitively? A merge counts only when it
// actually adds a tag, so re-importing the same tags is a no-op, not a merge.
function tagSetsDiffer(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return true
    }

   const seen = new Set(a.map((tag) => tag.trim().toLowerCase()))

  for (const tag of b) {
    if (!seen.has(tag.trim().toLowerCase())) {
      return true
      }
      }

  return false
}

export type ImportResult = {
  imported: number
  skippedDuplicates: number
  mergedTags: number
  failed: ImportFailure[]
}

// Imports a parsed collection in one transaction. Duplicate detection is a
// single up-front scan (not a query per row), so a 5,000-row file does not
// issue 5,000 lookups. A malformed row fails that row, not the import, and no
// metadata is fetched. The `duplicates` strategy decides what a canonical
// collision does: skip leaves the existing row, merge-tags unions only the new
// tags, and create-anyway inserts a true duplicate. The source's createdAt is
// preserved so an imported collection keeps its history.
export async function importBookmarks(
   userId: number,
   rows: ParsedImportRow[],
   options?: { duplicates?: DuplicateStrategy }
 ): Promise<ImportResult> {
   await ensureBookmarksTable()

   const strategy = options?.duplicates ?? "skip"
  const failed: ImportFailure[] = []
  let imported = 0
  let skippedDuplicates = 0
  let mergedTags = 0

    // Load the user's active rows once so canonicalization and dedupe stay in
    // memory for the whole file. Comparison is on the canonical URL, so a row
    // already stored under a non-canonical form is still recognized as a
    // duplicate.
  const activeRows = await db
        .select({
         id: bookmarks.id,
         url: bookmarks.url,
         tags: bookmarks.tags,
          })
        .from(bookmarks)
        .where(and(eq(bookmarks.userId, userId), isNull(bookmarks.deletedAt)))

  const existingByCanonical = new Map<
    string,
    { id: number; tags: string[] }
    >()

  for (const row of activeRows) {
    const canonical = normalizeBookmarkUrl(row.url)

    if (canonical) {
      existingByCanonical.set(canonical, {
        id: row.id,
        tags: row.tags ?? [],
         })
         }
      }

       // A url the file repeats, so it is not inserted twice under skip/merge.
  const handledInFile = new Set<string>()
      // Per existing bookmark id, the tag union accumulated from every colliding
      // row, applied once at the end. `base` keeps the original tags so a merge
      // that adds nothing is not counted.
  const pendingMerges = new Map<number, { base: string[]; merged: string[] }>()
       // Rows that survive dedupe, classified up front so writes are one pass.
  const inserts: Array<{ row: ParsedImportRow; canonical: string }> = []

  return await db.transaction(async (tx) => {
     for (const [index, row] of rows.entries()) {
      const canonical = normalizeBookmarkUrl(row.url)

      if (!canonical) {
        failed.push({ line: index + 1, url: row.url, reason: "Invalid URL" })
        continue
             }

      const existing = existingByCanonical.get(canonical)
      const handled = handledInFile.has(canonical)

      if (strategy === "merge-tags" && existing) {
             // Every colliding row unions its tags into the existing bookmark; the
             // write happens once, so repeated rows all contribute.
          const entry =
            pendingMerges.get(existing.id) ?? {
              base: existing.tags,
             merged: existing.tags,
            }

          pendingMerges.set(existing.id, {
            base: entry.base,
             merged: unionTags(entry.merged, row.tags),
              })
          handledInFile.add(canonical)
          continue
               }

            // skip and create-anyway dedupe a url repeated within this same file.
      if (handled) {
        skippedDuplicates += 1
        continue
             }

      if (existing && strategy === "skip") {
        skippedDuplicates += 1
        continue
            }

      handledInFile.add(canonical)
      inserts.push({ row, canonical })
         }

        // Write phase: insert every surviving row, then apply the tag merges, all
        // inside the transaction so a failure rolls the whole import back.
     for (const { row, canonical } of inserts) {
      const createdAt = row.createdAt ? new Date(row.createdAt) : null

       await tx
              .insert(bookmarks)
              .values({
             userId,
             url: canonical,
             title: row.title?.trim() || null,
             description: row.description?.trim() || null,
             favicon: incomingAsset(row.favicon),
             previewImage: incomingAsset(row.previewImage),
             tags: normalizeTags(row.tags),
             isFavorite: row.isFavorite,
                 ...(createdAt ? { createdAt } : {}),
             updatedAt: new Date(),
              })

       imported += 1
          }

       for (const [id, entry] of pendingMerges) {
             // A merge counts only when the union actually adds a tag.
        if (tagSetsDiffer(entry.base, entry.merged)) {
          await tx
              .update(bookmarks)
              .set({
                 tags: entry.merged.length > 0 ? entry.merged : null,
                 updatedAt: new Date(),
             })
               .where(
                and(
                  eq(bookmarks.id, id),
                  eq(bookmarks.userId, userId),
                  isNull(bookmarks.deletedAt)
                   )
                  )

         mergedTags += 1
          }
         }

      return {
        imported,
        skippedDuplicates,
        mergedTags,
        failed,
           }
         })
        }
// Streams an export without ever loading the whole collection: it pages through
// the user's rows in bounded batches and yields each one ready to serialize.
// Trash is excluded by default; pass includeTrashed to also emit soft-deleted
// rows. The row is mapped to the lossless export shape here so the route stays
// thin and the database client never touches the asset-URL decoding.
export async function* streamBookmarksForExport(
  userId: number,
  options?: { includeTrashed?: boolean }
): AsyncIterable<BookmarkExportRow> {
  await ensureBookmarksTable()

  const filters = [eq(bookmarks.userId, userId)]

  if (!options?.includeTrashed) {
    filters.push(isNull(bookmarks.deletedAt))
    }

  const whereClause = filters.length === 1 ? filters[0] : and(...filters)
  const pageSize = 200

  let offset = 0

  for (;;) {
    const rows = await db
      .select()
      .from(bookmarks)
      .where(whereClause)
      .orderBy(desc(bookmarks.createdAt), desc(bookmarks.id))
      .limit(pageSize)
      .offset(offset)

    if (rows.length === 0) {
      break
       }

      for (const row of rows) {
        yield {
          url: row.url,
          title: row.title,
          description: row.description,
           favicon: decodeAssetUrl(row.favicon),
           previewImage: decodeAssetUrl(row.previewImage),
          tags: parseTags(row.tags),
          isFavorite: row.isFavorite,
          visitCount: row.visitCount,
          createdAt:
            row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
          updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
          lastVisitedAt:
            row.lastVisitedAt
                ? row.lastVisitedAt.toISOString()
                : null,
          deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
          // Story 7 enrichments, mapped for a lossless export round-trip.
          // publishedAt is a DB timestamp (ISO-ized like the others); the
          // remaining four are plain text and pass through as-is.
          siteName: row.siteName,
          author: row.author,
          publishedAt:
            row.publishedAt ? row.publishedAt.toISOString() : null,
          language: row.language,
          canonicalUrl: row.canonicalUrl,
            }
        }

    if (rows.length < pageSize) {
      break
       }

    offset += rows.length
      }
    }
