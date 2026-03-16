import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm"

import { db } from "@/db/client"
import { bookmarks } from "@/db/schema"
import { ensureAuthSchema } from "@/lib/auth"

export type BookmarkCardData = {
  id: string
  url: string
  title: string
  description: string
  favicon: string
  previewImage: string | null
  tags: string[]
  createdAt: string
  isFavorite: boolean
  visitCount: number
}

export type BookmarkTagSummary = {
  tag: string
  count: number
}

export type BookmarkView = "recent" | "mostVisited" | "unorganized"

const DEFAULT_FAVICON =
  "https://www.gstatic.com/images/branding/searchlogo/ico/favicon.ico"

let isSchemaReady = false

async function ensureBookmarksTable() {
  if (isSchemaReady) {
    return
  }

  await ensureAuthSchema()

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      title TEXT,
      description TEXT,
      favicon TEXT,
      preview_image TEXT,
      is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
      visit_count INTEGER NOT NULL DEFAULT 0,
      tags TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)

  await db.execute(sql`
    ALTER TABLE bookmarks
    ADD COLUMN IF NOT EXISTS visit_count INTEGER NOT NULL DEFAULT 0
  `)

  await db.execute(sql`
    ALTER TABLE bookmarks
    ADD COLUMN IF NOT EXISTS preview_image TEXT
  `)

  await db.execute(sql`
    ALTER TABLE bookmarks
    ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
  `)

  isSchemaReady = true
}

function parseTags(rawTags: string | null): string[] {
  if (!rawTags) {
    return []
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
    favicon: bookmark.favicon ?? DEFAULT_FAVICON,
    previewImage: bookmark.previewImage,
    tags: parseTags(bookmark.tags),
    createdAt: bookmark.createdAt
      ? bookmark.createdAt.toISOString()
      : new Date().toISOString(),
    isFavorite: bookmark.isFavorite,
    visitCount: bookmark.visitCount,
  }
}

export async function listBookmarks(
  userId: number,
  options?: {
    search?: string
    onlyFavorites?: boolean
    view?: BookmarkView
    tag?: string
  }
) {
  await ensureBookmarksTable()

  const search = options?.search?.trim()
  const tag = options?.tag?.trim()
  const filters = []

  filters.push(eq(bookmarks.userId, userId))

  if (options?.onlyFavorites) {
    filters.push(eq(bookmarks.isFavorite, true))
  }

  if (search) {
    filters.push(
      or(
        ilike(bookmarks.url, `%${search}%`),
        ilike(bookmarks.title, `%${search}%`),
        ilike(bookmarks.description, `%${search}%`),
        ilike(bookmarks.tags, `%${search}%`)
      )
    )
  }

  if (tag) {
    filters.push(ilike(bookmarks.tags, `%${tag}%`))
  }

  if (options?.view === "unorganized") {
    filters.push(
      or(
        isNull(bookmarks.tags),
        eq(bookmarks.tags, ""),
        eq(bookmarks.tags, "[]")
      )
    )
  }

  const whereClause = filters.length === 1 ? filters[0] : and(...filters)

  const rows = await db
    .select()
    .from(bookmarks)
    .where(whereClause)
    .orderBy(
      options?.view === "mostVisited"
        ? desc(bookmarks.visitCount)
        : desc(bookmarks.createdAt),
      desc(bookmarks.createdAt)
    )

  const mappedRows = rows.map(toCardData)

  if (!tag) {
    return mappedRows
  }

  const normalizedTag = tag.toLowerCase()
  return mappedRows.filter((bookmark) =>
    bookmark.tags.some(
      (bookmarkTag) => bookmarkTag.toLowerCase() === normalizedTag
    )
  )
}

export async function listBookmarkTags(userId: number, query?: string) {
  await ensureBookmarksTable()

  const rows = await db
    .select({ tags: bookmarks.tags })
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId))
  const normalizedQuery = query?.trim().toLowerCase()
  const tagCounts = new Map<string, number>()

  for (const row of rows) {
    for (const tag of parseTags(row.tags)) {
      const normalizedTag = tag.trim()

      if (!normalizedTag) {
        continue
      }

      tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) ?? 0) + 1)
    }
  }

  return [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .filter((entry) => {
      if (!normalizedQuery) {
        return true
      }

      return entry.tag.toLowerCase().includes(normalizedQuery)
    })
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count
      }

      return a.tag.localeCompare(b.tag)
    })
}

function normalizeTags(tags?: string[] | string | null) {
  if (!tags) {
    return null
  }

  if (Array.isArray(tags)) {
    const normalized = tags.map((tag) => tag.trim()).filter(Boolean)

    return normalized.length > 0 ? JSON.stringify(normalized) : null
  }

  const normalized = tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)

  return normalized.length > 0 ? JSON.stringify(normalized) : null
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

  const [created] = await db
    .insert(bookmarks)
    .values({
      userId,
      url: input.url,
      title: input.title?.trim() || null,
      description: input.description?.trim() || null,
      favicon: input.favicon?.trim() || null,
      previewImage: input.previewImage?.trim() || null,
      tags: normalizeTags(input.tags),
      isFavorite: input.isFavorite ?? false,
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

  const [updated] = await db
    .update(bookmarks)
    .set({
      url: input.url,
      title: input.title?.trim() || null,
      description: input.description?.trim() || null,
      favicon: input.favicon?.trim() || null,
      previewImage: input.previewImage?.trim() || null,
      tags: normalizeTags(input.tags),
    })
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .returning()

  return updated ? toCardData(updated) : null
}

export async function toggleFavoriteById(userId: number, id: number) {
  await ensureBookmarksTable()

  const [existing] = await db
    .select({ isFavorite: bookmarks.isFavorite })
    .from(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .limit(1)

  if (!existing) {
    return false
  }

  await db
    .update(bookmarks)
    .set({ isFavorite: !existing.isFavorite })
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))

  return true
}

export async function deleteBookmarkById(userId: number, id: number) {
  await ensureBookmarksTable()

  const deleted = await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .returning({ id: bookmarks.id })

  return deleted.length > 0
}

export async function incrementBookmarkVisitById(userId: number, id: number) {
  await ensureBookmarksTable()

  const updated = await db
    .update(bookmarks)
    .set({
      visitCount: sql`${bookmarks.visitCount} + 1`,
    })
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .returning({ id: bookmarks.id })

  return updated.length > 0
}

export async function resetBookmarkVisitCountById(userId: number, id: number) {
  await ensureBookmarksTable()

  const updated = await db
    .update(bookmarks)
    .set({ visitCount: 0 })
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .returning({ id: bookmarks.id })

  return updated.length > 0
}
