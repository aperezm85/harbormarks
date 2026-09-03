export type BookmarkCardData = {
  id: string
  url: string
  title: string
  description: string
  favicon: string
  previewImage: string | null
  tags: string[]
  createdAt: string
  updatedAt: string | null
  lastVisitedAt: string | null
  isFavorite: boolean
  visitCount: number
  // Story 7 enrichment columns (nullable, best-effort extraction).
  siteName: string | null
  author: string | null
  publishedAt: string | null
  language: string | null
  canonicalUrl: string | null
}

export type BookmarkTagSummary = {
  tag: string
  count: number
}

export type BookmarkView = "recent" | "mostVisited" | "unorganized" | "trash"

export const DEFAULT_BOOKMARK_PAGE_SIZE = 50
