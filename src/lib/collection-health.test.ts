import { describe, expect, it } from "vitest"

import { buildCollectionHealthSummary } from "@/lib/collection-health"

const NOW = new Date("2026-10-11T08:00:00.000Z")

describe("buildCollectionHealthSummary", () => {
  it("builds the core health widgets from bookmark data", () => {
    const summary = buildCollectionHealthSummary(
      [
        {
          id: 1,
          url: "https://old-domain.com/post",
          canonicalUrl: "https://new-domain.com/post",
          title: "Old post",
          tags: ["Docker", "DevOps"],
          linkHealth: "ok",
          status: "reading",
          createdAt: new Date("2025-01-10T00:00:00.000Z"),
          updatedAt: new Date("2026-10-08T00:00:00.000Z"),
          lastVisitedAt: new Date("2026-08-01T00:00:00.000Z"),
        },
        {
          id: 2,
          url: "https://exampleblog.net/dead-1",
          canonicalUrl: null,
          title: "Dead link 1",
          tags: null,
          linkHealth: "broken",
          status: "unread",
          createdAt: new Date("2024-06-10T00:00:00.000Z"),
          updatedAt: new Date("2026-10-09T00:00:00.000Z"),
          lastVisitedAt: null,
        },
        {
          id: 3,
          url: "https://exampleblog.net/dead-2",
          canonicalUrl: null,
          title: "Dead link 2",
          tags: ["AI"],
          linkHealth: "broken",
          status: "unread",
          createdAt: new Date("2024-07-10T00:00:00.000Z"),
          updatedAt: new Date("2026-09-01T00:00:00.000Z"),
          lastVisitedAt: null,
        },
        {
          id: 4,
          url: "https://github.com/org/repo",
          canonicalUrl: null,
          title: "Repo",
          tags: ["DevOps"],
          linkHealth: "ok",
          status: "reading",
          createdAt: new Date("2026-06-10T00:00:00.000Z"),
          updatedAt: new Date("2026-06-10T00:00:00.000Z"),
          lastVisitedAt: new Date("2026-09-10T00:00:00.000Z"),
        },
        {
          id: 5,
          url: "https://new-domain.com/post?utm_source=x",
          canonicalUrl: "https://new-domain.com/post",
          title: "Old post",
          tags: ["Docker"],
          linkHealth: "ok",
          status: "unread",
          createdAt: new Date("2026-05-10T00:00:00.000Z"),
          updatedAt: new Date("2026-05-10T00:00:00.000Z"),
          lastVisitedAt: null,
        },
      ],
      NOW
    )

    expect(summary.totals.broken).toBe(2)
    expect(summary.totals.duplicates).toBe(1)
    expect(summary.totals.untagged).toBe(1)
    expect(summary.attention.redirectedLinks.count).toBe(1)
    expect(summary.attention.deadDomains.domains[0]).toEqual({
      domain: "exampleblog.net",
      count: 2,
    })
    expect(summary.organisation.inboxBacklog.total).toBe(3)
    expect(summary.bookmarkDebt.total).toBeGreaterThan(0)
    expect(summary.trends.growth).toHaveLength(12)
    expect(summary.rediscovery.length).toBeGreaterThan(0)
  })
})
