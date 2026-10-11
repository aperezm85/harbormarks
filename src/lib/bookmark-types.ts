export type BookmarkStatus = "unread" | "reading" | "archived"
export type BookmarkLinkHealth = "unknown" | "checking" | "ok" | "broken"

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
  linkHealth: BookmarkLinkHealth
  // Story 7 enrichment columns (nullable, best-effort extraction).
  siteName: string | null
  author: string | null
  publishedAt: string | null
  language: string | null
  canonicalUrl: string | null
  // Story 12 notes-only slice: private user note, always present on card data
  // (null when unset).
  note: string | null
  // Read status slice: unread | reading | archived, always present.
  status: BookmarkStatus
}

export type BookmarkTagSummary = {
  tag: string
  count: number
}

export type BookmarkView =
  | "recent"
  | "mostVisited"
  | "unorganized"
  | "trash"
  | "unread"

// Per-view totals for the dashboard subbar chips. Kept in this shared types
// module (not in the server data layer) so client components can reference the
// shape without importing a module that pulls in the Node-only Postgres driver.
export type BookmarkViewCounts = {
  recent: number
  mostVisited: number
  unorganized: number
  favorites: number
  trash: number
  unread: number
}

export type CollectionHealthScore = {
  value: number
  label: "Excellent" | "Good" | "Fair" | "Needs attention"
  deltaFromLastWeek: number
}

export type CollectionHealthMonthlyGrowth = {
  month: string
  total: number
}

export type CollectionHealthKnowledgeArea = {
  tag: string
  count: number
  percentage: number
}

export type CollectionHealthDomainCount = {
  domain: string
  count: number
}

export type CollectionHealthDuplicateExample = {
  title: string
  savedAt: string[]
}

export type CollectionHealthRediscoveryItem = {
  id: string
  title: string
  url: string
  savedAgoLabel: string
  reason: string
}

export type CollectionHealthSummary = {
  generatedAt: string
  score: CollectionHealthScore
  totals: {
    healthy: number
    broken: number
    duplicates: number
    untagged: number
  }
  attention: {
    brokenLinks: {
      count: number
      sinceLastScan: number
    }
    redirectedLinks: {
      count: number
      examples: { from: string; to: string }[]
    }
    deadDomains: {
      count: number
      domains: CollectionHealthDomainCount[]
    }
  }
  organisation: {
    untaggedCount: number
    suggestedTags: string[]
    duplicateExamples: CollectionHealthDuplicateExample[]
    inboxBacklog: {
      total: number
      over30Days: number
    }
    staleCount: number
  }
  trends: {
    growth: CollectionHealthMonthlyGrowth[]
    knowledgeAreas: CollectionHealthKnowledgeArea[]
  }
  preservationRisk: {
    low: number
    medium: number
    high: number
    highRiskSources: CollectionHealthDomainCount[]
  }
  rediscovery: CollectionHealthRediscoveryItem[]
  advanced: {
    domainAnalysis: CollectionHealthDomainCount[]
    orphanedTags: { tag: string; count: number }[]
    largestCollections: { tag: string; count: number }[]
  }
  bookmarkDebt: {
    total: number
    unprocessed: number
    broken: number
    duplicates: number
    stale: number
    estimatedCleanupMinutes: number
  }
}

export const DEFAULT_BOOKMARK_PAGE_SIZE = 50
