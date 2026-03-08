import { and, desc, eq, ilike, or, sql } from "drizzle-orm"

import { db } from "@/db/client"
import { bookmarks } from "@/db/schema"

export type BookmarkCardData = {
  id: string
  url: string
  title: string
  description: string
  favicon: string
  tags: string[]
  createdAt: string
  isFavorite: boolean
}

const DEFAULT_FAVICON =
  "https://www.gstatic.com/images/branding/searchlogo/ico/favicon.ico"

let isSchemaReady = false

async function ensureBookmarksTable() {
  if (isSchemaReady) {
    return
  }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id SERIAL PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT,
      description TEXT,
      favicon TEXT,
      is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
      tags TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
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
    tags: parseTags(bookmark.tags),
    createdAt: bookmark.createdAt
      ? bookmark.createdAt.toISOString()
      : new Date().toISOString(),
    isFavorite: bookmark.isFavorite,
  }
}

export async function listBookmarks(options?: {
  search?: string
  onlyFavorites?: boolean
}) {
  await ensureBookmarksTable()

  const search = options?.search?.trim()
  const filters = []

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

  const whereClause =
    filters.length === 0
      ? undefined
      : filters.length === 1
        ? filters[0]
        : and(...filters)

  const rows = await db
    .select()
    .from(bookmarks)
    .where(whereClause)
    .orderBy(desc(bookmarks.createdAt))

  return rows.map(toCardData)
}

export async function listBookmarkTags(query?: string) {
  await ensureBookmarksTable()

  const rows = await db.select({ tags: bookmarks.tags }).from(bookmarks)
  const normalizedQuery = query?.trim().toLowerCase()
  const uniqueTags = new Set<string>()

  for (const row of rows) {
    for (const tag of parseTags(row.tags)) {
      const normalizedTag = tag.trim()

      if (!normalizedTag) {
        continue
      }

      if (
        normalizedQuery &&
        !normalizedTag.toLowerCase().includes(normalizedQuery)
      ) {
        continue
      }

      uniqueTags.add(normalizedTag)
    }
  }

  return [...uniqueTags].sort((a, b) => a.localeCompare(b))
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

export async function createBookmark(input: {
  url: string
  title?: string | null
  description?: string | null
  favicon?: string | null
  tags?: string[] | string | null
}) {
  await ensureBookmarksTable()

  const [created] = await db
    .insert(bookmarks)
    .values({
      url: input.url,
      title: input.title?.trim() || null,
      description: input.description?.trim() || null,
      favicon: input.favicon?.trim() || null,
      tags: normalizeTags(input.tags),
    })
    .returning()

  return toCardData(created)
}

export async function toggleFavoriteById(id: number) {
  await ensureBookmarksTable()

  const [existing] = await db
    .select({ isFavorite: bookmarks.isFavorite })
    .from(bookmarks)
    .where(eq(bookmarks.id, id))
    .limit(1)

  if (!existing) {
    return false
  }

  await db
    .update(bookmarks)
    .set({ isFavorite: !existing.isFavorite })
    .where(eq(bookmarks.id, id))

  return true
}

export async function deleteBookmarkById(id: number) {
  await ensureBookmarksTable()

  const deleted = await db
    .delete(bookmarks)
    .where(eq(bookmarks.id, id))
    .returning({ id: bookmarks.id })

  return deleted.length > 0
}
