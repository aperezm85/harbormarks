import { normalizeBookmarkUrl } from "@/lib/bookmark-url"
import type { CollectionHealthSummary } from "@/lib/bookmark-types"

export type CollectionHealthSourceBookmark = {
  id: number
  url: string
  title: string | null
  canonicalUrl: string | null
  tags: string[] | null
  linkHealth: string | null
  status: string | null
  createdAt: Date | null
  updatedAt: Date | null
  lastVisitedAt: Date | null
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const REDISCOVERY_AGE_DAYS = 365
const STALE_AGE_DAYS = 180

const LOW_RISK_DOMAINS = [
  "github.com",
  "developer.mozilla.org",
  "docs.microsoft.com",
  "learn.microsoft.com",
  "wikipedia.org",
  "docs.docker.com",
  "python.org",
  "nodejs.org",
]

function safeHost(rawUrl: string | null): string | null {
  if (!rawUrl) {
    return null
  }

  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return null
  }
}

function normalizeCanonicalKey(row: CollectionHealthSourceBookmark): string | null {
  const canonical = normalizeBookmarkUrl(row.canonicalUrl)
  if (canonical) {
    return canonical
  }
  return normalizeBookmarkUrl(row.url)
}

function trimTitle(title: string | null, fallback: string): string {
  const normalized = title?.trim()
  return normalized && normalized.length > 0 ? normalized : fallback
}

function formatSavedAgo(date: Date, now: Date): string {
  const days = Math.max(1, Math.floor((now.getTime() - date.getTime()) / ONE_DAY_MS))
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (years >= 1) {
    return years === 1 ? "Saved 1 year ago" : `Saved ${years} years ago`
  }

  if (months >= 1) {
    return months === 1 ? "Saved 1 month ago" : `Saved ${months} months ago`
  }

  return days === 1 ? "Saved 1 day ago" : `Saved ${days} days ago`
}

function toSortedDomainCounts(map: Map<string, number>) {
  return [...map.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((left, right) =>
      right.count === left.count
        ? left.domain.localeCompare(right.domain)
        : right.count - left.count
    )
}

function scoreLabel(score: number): CollectionHealthSummary["score"]["label"] {
  if (score >= 85) {
    return "Excellent"
  }
  if (score >= 70) {
    return "Good"
  }
  if (score >= 50) {
    return "Fair"
  }
  return "Needs attention"
}

function isLowRiskDomain(host: string): boolean {
  if (LOW_RISK_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
    return true
  }

  return host.endsWith(".gov") || host.endsWith(".edu")
}

function monthLabels(now: Date): { key: string; label: string; monthEnd: Date }[] {
  const values: { key: string; label: string; monthEnd: Date }[] = []

  for (let offset = 11; offset >= 0; offset -= 1) {
    const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))
    const monthEnd = new Date(
      Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0, 23, 59, 59, 999)
    )
    values.push({
      key: `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, "0")}`,
      label: monthDate.toLocaleString("en", { month: "short", timeZone: "UTC" }),
      monthEnd,
    })
  }

  return values
}

export function buildCollectionHealthSummary(
  rows: CollectionHealthSourceBookmark[],
  now: Date = new Date()
): CollectionHealthSummary {
  const lastWeek = new Date(now.getTime() - 7 * ONE_DAY_MS)
  const staleBefore = new Date(now.getTime() - STALE_AGE_DAYS * ONE_DAY_MS)
  const rediscoveryBefore = new Date(now.getTime() - REDISCOVERY_AGE_DAYS * ONE_DAY_MS)

  const healthBrokenRows = rows.filter((row) => row.linkHealth === "broken")
  const healthyCount = rows.filter((row) => row.linkHealth === "ok").length
  const untaggedCount = rows.filter((row) => !row.tags || row.tags.length === 0).length

  const duplicateGroups = new Map<string, CollectionHealthSourceBookmark[]>()
  for (const row of rows) {
    const key = normalizeCanonicalKey(row)
    if (!key) {
      continue
    }
    const existing = duplicateGroups.get(key)
    if (existing) {
      existing.push(row)
    } else {
      duplicateGroups.set(key, [row])
    }
  }

  const groupedDuplicates = [...duplicateGroups.values()]
    .filter((group) => group.length > 1)
    .sort((left, right) => right.length - left.length)
  const duplicateCount = groupedDuplicates.reduce(
    (total, group) => total + (group.length - 1),
    0
  )

  const staleCount = rows.filter((row) => {
    const createdAt = row.createdAt
    if (!createdAt || createdAt > staleBefore) {
      return false
    }
    if (!row.lastVisitedAt) {
      return true
    }
    return row.lastVisitedAt <= staleBefore
  }).length

  const brokenSinceLastScan = healthBrokenRows.filter(
    (row) => row.updatedAt && row.updatedAt >= lastWeek
  ).length

  const fixedSinceLastWeek = rows.filter(
    (row) => row.linkHealth === "ok" && row.updatedAt && row.updatedAt >= lastWeek
  ).length
  const scoreDelta = Math.max(-9, Math.min(9, fixedSinceLastWeek - brokenSinceLastScan))

  const basePenalty =
    healthBrokenRows.length * 3 + duplicateCount * 2 + untaggedCount + staleCount
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(100 - (basePenalty / Math.max(1, rows.length * 3)) * 100)
    )
  )

  const redirectedRows = rows
    .map((row) => {
      const source = normalizeBookmarkUrl(row.url)
      const target = normalizeBookmarkUrl(row.canonicalUrl)
      if (!source || !target || source === target) {
        return null
      }
      return { from: source, to: target }
    })
    .filter((value): value is { from: string; to: string } => value !== null)

  const brokenByDomain = new Map<string, number>()
  for (const row of healthBrokenRows) {
    const host = safeHost(normalizeBookmarkUrl(row.url))
    if (!host) {
      continue
    }
    brokenByDomain.set(host, (brokenByDomain.get(host) ?? 0) + 1)
  }
  const deadDomains = toSortedDomainCounts(brokenByDomain)

  const tagCounts = new Map<string, number>()
  for (const row of rows) {
    for (const tag of row.tags ?? []) {
      const normalized = tag.trim()
      if (!normalized) {
        continue
      }
      tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1)
    }
  }
  const sortedTags = [...tagCounts.entries()].sort((left, right) =>
    right[1] === left[1] ? left[0].localeCompare(right[0]) : right[1] - left[1]
  )

  const unreadRows = rows.filter((row) => row.status === "unread")
  const unreadOlderThan30 = unreadRows.filter(
    (row) => row.createdAt && row.createdAt <= new Date(now.getTime() - 30 * ONE_DAY_MS)
  ).length

  const trendMonths = monthLabels(now)
  const growth = trendMonths.map((month) => ({
    month: month.label,
    total: rows.filter((row) => row.createdAt && row.createdAt <= month.monthEnd).length,
  }))

  const totalTagReferences = sortedTags.reduce((total, [, count]) => total + count, 0)
  const topKnowledgeAreas = sortedTags.slice(0, 4).map(([tag, count]) => ({
    tag,
    count,
    percentage:
      totalTagReferences === 0
        ? 0
        : Math.round((count / totalTagReferences) * 100),
  }))

  const topKnowledgeAreaTotal = topKnowledgeAreas.reduce(
    (total, item) => total + item.percentage,
    0
  )
  const knowledgeAreas =
    totalTagReferences > 0 && topKnowledgeAreaTotal < 100
      ? [...topKnowledgeAreas, { tag: "Other", count: 0, percentage: 100 - topKnowledgeAreaTotal }]
      : topKnowledgeAreas

  const domains = new Map<string, number>()
  for (const row of rows) {
    const host = safeHost(normalizeBookmarkUrl(row.canonicalUrl) ?? normalizeBookmarkUrl(row.url))
    if (!host) {
      continue
    }
    domains.set(host, (domains.get(host) ?? 0) + 1)
  }
  const sortedDomains = toSortedDomainCounts(domains)

  let lowRisk = 0
  let mediumRisk = 0
  let highRisk = 0
  const highRiskDomainCounts = new Map<string, number>()
  for (const row of rows) {
    const host = safeHost(normalizeBookmarkUrl(row.canonicalUrl) ?? normalizeBookmarkUrl(row.url))
    if (!host) {
      highRisk += 1
      continue
    }

    const count = domains.get(host) ?? 0
    if (isLowRiskDomain(host)) {
      lowRisk += 1
      continue
    }

    if (count <= 2) {
      highRisk += 1
      highRiskDomainCounts.set(host, (highRiskDomainCounts.get(host) ?? 0) + 1)
      continue
    }

    mediumRisk += 1
  }

  const rediscoveryCandidates = rows
    .filter(
      (row) =>
        row.createdAt &&
        row.createdAt <= rediscoveryBefore &&
        (!row.lastVisitedAt || row.lastVisitedAt <= rediscoveryBefore)
    )
    .sort((left, right) =>
      (left.createdAt?.getTime() ?? 0) - (right.createdAt?.getTime() ?? 0)
    )
    .slice(0, 3)
    .map((row) => {
      const tags = row.tags ?? []
      const topMatchingTag = topKnowledgeAreas.find((area) => tags.includes(area.tag))
      return {
        id: String(row.id),
        title: trimTitle(row.title, row.url),
        url: row.url,
        savedAgoLabel: formatSavedAgo(row.createdAt!, now),
        reason: topMatchingTag
          ? `Relevant to your ${topMatchingTag.tag} collection`
          : "Never reopened",
      }
    })

  const orphanedTags = sortedTags
    .filter(([, count]) => count === 1)
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }))
  const largestCollections = sortedTags
    .slice(0, 4)
    .map(([tag, count]) => ({ tag, count }))

  const debtUnprocessed = unreadRows.length
  const debtBroken = healthBrokenRows.length
  const debtDuplicates = duplicateCount
  const debtStale = staleCount
  const debtTotal = debtUnprocessed + debtBroken + debtDuplicates + debtStale

  return {
    generatedAt: now.toISOString(),
    score: {
      value: score,
      label: scoreLabel(score),
      deltaFromLastWeek: scoreDelta,
    },
    totals: {
      healthy: healthyCount,
      broken: healthBrokenRows.length,
      duplicates: duplicateCount,
      untagged: untaggedCount,
    },
    attention: {
      brokenLinks: {
        count: healthBrokenRows.length,
        sinceLastScan: brokenSinceLastScan,
      },
      redirectedLinks: {
        count: redirectedRows.length,
        examples: redirectedRows.slice(0, 3),
      },
      deadDomains: {
        count: deadDomains.length,
        domains: deadDomains.slice(0, 5),
      },
    },
    organisation: {
      untaggedCount,
      suggestedTags: sortedTags.slice(0, 4).map(([tag]) => tag),
      duplicateExamples: groupedDuplicates.slice(0, 3).map((group) => ({
        title: trimTitle(group[0].title, group[0].url),
        savedAt: group
          .map((item) =>
            item.createdAt
              ? item.createdAt.toLocaleString("en", {
                  month: "short",
                  year: "numeric",
                  timeZone: "UTC",
                })
              : "Unknown"
          )
          .slice(0, 3),
      })),
      inboxBacklog: {
        total: unreadRows.length,
        over30Days: unreadOlderThan30,
      },
      staleCount,
    },
    trends: {
      growth,
      knowledgeAreas,
    },
    preservationRisk: {
      low: lowRisk,
      medium: mediumRisk,
      high: highRisk,
      highRiskSources: toSortedDomainCounts(highRiskDomainCounts).slice(0, 5),
    },
    rediscovery: rediscoveryCandidates,
    advanced: {
      domainAnalysis: sortedDomains.slice(0, 5),
      orphanedTags,
      largestCollections,
    },
    bookmarkDebt: {
      total: debtTotal,
      unprocessed: debtUnprocessed,
      broken: debtBroken,
      duplicates: debtDuplicates,
      stale: debtStale,
      estimatedCleanupMinutes: Math.max(1, Math.ceil(debtTotal / 10)),
    },
  }
}
