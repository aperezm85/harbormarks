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

export const DEFAULT_BOOKMARK_PAGE_SIZE = 50
