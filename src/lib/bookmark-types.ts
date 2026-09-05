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

// Per-view totals for the dashboard subbar chips. Kept in this shared types
// module (not in the server data layer) so client components can reference the
// shape without importing a module that pulls in the Node-only Postgres driver.
export type BookmarkViewCounts = {
  recent: number
  mostVisited: number
  unorganized: number
  favorites: number
  trash: number
}

export const DEFAULT_BOOKMARK_PAGE_SIZE = 50
