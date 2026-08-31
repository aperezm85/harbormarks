import { and, desc, eq, isNull, or, sql } from "drizzle-orm"

import { db } from "@/db/client"
import { bookmarks } from "@/db/schema"
import { ensureAuthSchema } from "@/lib/auth"
import { normalizeBookmarkAssetUrl } from "@/lib/bookmark-assets"
import {
  type BookmarkCardData,
  type BookmarkTagSummary,
  type BookmarkView,
  DEFAULT_BOOKMARK_PAGE_SIZE,
} from "@/lib/bookmark-types"
import { normalizeBookmarkUrl } from "@/lib/bookmark-url"

export { DEFAULT_BOOKMARK_PAGE_SIZE }
export type { BookmarkCardData, BookmarkTagSummary, BookmarkView }
const BOOKMARK_SEARCH_VECTOR = sql`
  to_tsvector(
    'simple',
    concat_ws(
      ' ',
      bookmarks.url,
      coalesce(bookmarks.title, ''),
      coalesce(bookmarks.description, ''),
      coalesce(array_to_string(bookmarks.tags, ' '), '')
    )
  )
`

const DEFAULT_FAVICON = "/favicon.ico"

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

function parseTags(rawTags: string[] | string | null): string[] {
  if (!rawTags) {
    return []
  }

  if (Array.isArray(rawTags)) {
    return rawTags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)
  }

  try {
    const parsed = JSON.parse(rawTags)
    if (Array.isArray(parsed)) {
      return parsed.filter((tag): tag is string => typeof tag === "string")
    }
  } catch {
    // Fall through to comma-separated parsing.
  }

  return rawTags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
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

  const search = options?.search?.trim()
  const tag = options?.tag?.trim()
  const filters = []
  const searchQuery = search
    ? sql`websearch_to_tsquery('simple', ${search})`
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

  if (search) {
    filters.push(sql<boolean>`${BOOKMARK_SEARCH_VECTOR} @@ ${searchQuery}`)
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

function normalizeTags(tags?: string[] | string | null) {
  if (!tags) {
    return null
  }

  if (Array.isArray(tags)) {
    const normalized = tags.map((tag) => tag.trim()).filter(Boolean)

    return normalized.length > 0 ? normalized : null
  }

  const normalized = tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)

  return normalized.length > 0 ? normalized : null
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
  }
) {
  await ensureBookmarksTable()

  const normalizedUrl = normalizeBookmarkUrl(input.url)

  if (!normalizedUrl) {
    throw new Error("Invalid bookmark URL")
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
  }
) {
  await ensureBookmarksTable()

  const normalizedUrl = normalizeBookmarkUrl(input.url)

  if (!normalizedUrl) {
    return null
  }

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
