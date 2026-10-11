import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { CollectionHealthSummary } from "@/lib/bookmark-types"
import { toast } from "sonner"

const countClassName = "font-mono text-lg font-semibold tabular-nums"

function scoreTrendText(delta: number): string {
  if (delta > 0) {
    return `Your collection is healthier than last week (+${delta})`
  }
  if (delta < 0) {
    return `Your collection slipped since last week (${delta})`
  }
  return "Your collection is stable compared with last week"
}

export const CollectionHealthDashboard = ({
  summary,
  isLoading,
}: {
  summary: CollectionHealthSummary | null
  isLoading: boolean
}) => {
  const [isCheckingLinks, setIsCheckingLinks] = useState(false)

  const rerunBrokenLinkChecker = async () => {
    if (isCheckingLinks) {
      return
    }

    setIsCheckingLinks(true)
    try {
      const response = await fetch("/api/link-health/check-now", {
        method: "POST",
      })
      const result = (await response.json().catch(() => null)) as {
        error?: string
        data?: { checked?: number; healthy?: number; broken?: number }
      } | null

      if (!response.ok) {
        throw new Error(result?.error ?? "Could not check links.")
      }

      const checked = result?.data?.checked ?? 0
      const healthy = result?.data?.healthy ?? 0
      const broken = result?.data?.broken ?? 0
      const message =
        checked === 0
          ? "Nothing to check — all links are already verified."
          : `Checked ${checked} link${checked === 1 ? "" : "s"}: ${healthy} healthy, ${broken} broken.`

      toast.success(message)
      window.dispatchEvent(new CustomEvent("harbormarks:bookmarks-changed"))
      window.dispatchEvent(new CustomEvent("harbormarks:tags-changed"))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not check links."
      toast.error(message)
    } finally {
      setIsCheckingLinks(false)
    }
  }

  if (isLoading && !summary) {
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Collection Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Building your collection dashboard…
        </CardContent>
      </Card>
    )
  }

  if (!summary) {
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Collection Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No bookmarks yet. Add your first link to start tracking collection
          dashboard metrics.
        </CardContent>
      </Card>
    )
  }

  const growthMax = Math.max(1, ...summary.trends.growth.map((point) => point.total))

  return (
    <section className="mb-4 space-y-4">
      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-base">Collection Dashboard Score</CardTitle>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex size-28 items-center justify-center rounded-full border-4 border-primary/35 bg-primary/10">
              <div className="text-center">
                <p className="font-mono text-3xl leading-none font-bold tabular-nums">
                  {summary.score.value}
                </p>
                <p className="pt-1 text-xs font-medium text-muted-foreground">
                  {summary.score.label}
                </p>
              </div>
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">
                {scoreTrendText(summary.score.deltaFromLastWeek)}
              </p>
              <p>
                Influenced by broken links, missing metadata, duplicates,
                untagged bookmarks, stale entries, and domain risk.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Healthy</p>
            <p className={countClassName}>{summary.totals.healthy}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Broken</p>
            <p className={countClassName}>{summary.totals.broken}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Duplicates</p>
            <p className={countClassName}>{summary.totals.duplicates}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Untagged</p>
            <p className={countClassName}>{summary.totals.untagged}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">🔴 Requires Attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="font-medium">Broken Links: {summary.attention.brokenLinks.count}</p>
              <p className="text-xs text-muted-foreground">
                {summary.attention.brokenLinks.sinceLastScan >= 0 ? "+" : ""}
                {summary.attention.brokenLinks.sinceLastScan} since last scan
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2"
                disabled={isCheckingLinks}
                onClick={() => {
                  void rerunBrokenLinkChecker()
                }}
              >
                {isCheckingLinks ? "Checking…" : "Re-run checker"}
              </Button>
            </div>
            <div className="rounded-md border p-3">
              <p className="font-medium">
                Redirected Links: {summary.attention.redirectedLinks.count}
              </p>
              {summary.attention.redirectedLinks.examples.slice(0, 2).map((item) => (
                <p key={item.from} className="text-xs text-muted-foreground">
                  {item.from} → {item.to}
                </p>
              ))}
            </div>
            <div className="rounded-md border p-3">
              <p className="font-medium">
                Dead Domains: {summary.attention.deadDomains.count}
              </p>
              {summary.attention.deadDomains.domains.slice(0, 3).map((domain) => (
                <p key={domain.domain} className="text-xs text-muted-foreground">
                  {domain.domain} ({domain.count} bookmarks)
                </p>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">🟡 Needs Organisation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="font-medium">
                Untagged Bookmarks: {summary.organisation.untaggedCount}
              </p>
              {summary.organisation.suggestedTags.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Suggested tags: {summary.organisation.suggestedTags.join(", ")}
                </p>
              ) : null}
              <Button asChild type="button" variant="secondary" size="sm" className="mt-2">
                <a href="/?view=unorganized">Review unassigned</a>
              </Button>
            </div>
            <div className="rounded-md border p-3">
              <p className="font-medium">
                Duplicate Content: {summary.totals.duplicates}
              </p>
              {summary.organisation.duplicateExamples.slice(0, 2).map((duplicate) => (
                <p key={duplicate.title} className="text-xs text-muted-foreground">
                  {duplicate.title} ({duplicate.savedAt.join(" / ")})
                </p>
              ))}
            </div>
            <div className="rounded-md border p-3">
              <p className="font-medium">
                Inbox Backlog: {summary.organisation.inboxBacklog.total}
              </p>
              <p className="text-xs text-muted-foreground">
                {summary.organisation.inboxBacklog.over30Days} saved over 30
                days ago
              </p>
              <Button asChild type="button" variant="secondary" size="sm" className="mt-2">
                <a href="/?view=unread">Open inbox</a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Collection Trends</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="mb-2 font-medium">Growth (Last 12 months)</p>
              <div className="space-y-1.5">
                {summary.trends.growth.map((point) => (
                  <div key={point.month} className="flex items-center gap-2">
                    <span className="w-8 text-xs text-muted-foreground">
                      {point.month}
                    </span>
                    <div className="h-2 flex-1 rounded bg-muted">
                      <div
                        className="h-2 rounded bg-primary/70"
                        style={{
                          width: `${Math.max(
                            6,
                            Math.round((point.total / growthMax) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="w-12 text-right font-mono text-xs tabular-nums">
                      {point.total}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 font-medium">Knowledge Areas</p>
              <div className="space-y-1">
                {summary.trends.knowledgeAreas.map((item) => (
                  <p key={item.tag} className="text-xs text-muted-foreground">
                    <span className="inline-block min-w-24 text-foreground">
                      {item.tag}
                    </span>
                    {item.percentage}%
                  </p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Link Rot & Rediscovery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-md border p-3">
              <p className="font-medium">Preservation Risk</p>
              <p className="text-xs text-muted-foreground">
                Low {summary.preservationRisk.low} · Medium{" "}
                {summary.preservationRisk.medium} · High{" "}
                {summary.preservationRisk.high}
              </p>
              {summary.preservationRisk.highRiskSources.slice(0, 3).map((item) => (
                <p key={item.domain} className="text-xs text-muted-foreground">
                  {item.domain} ({item.count})
                </p>
              ))}
            </div>
            <div className="rounded-md border p-3">
              <p className="mb-1 font-medium">Worth Revisiting</p>
              {summary.rediscovery.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No rediscovery picks yet.
                </p>
              ) : (
                summary.rediscovery.map((item) => (
                  <p key={item.id} className="text-xs text-muted-foreground">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-foreground hover:underline"
                    >
                      {item.title}
                    </a>{" "}
                    — {item.savedAgoLabel}. {item.reason}.
                  </p>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Advanced View</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-3">
            <div>
              <p className="mb-1 font-medium">Domain Analysis</p>
              {summary.advanced.domainAnalysis.map((item) => (
                <p key={item.domain} className="text-xs text-muted-foreground">
                  {item.domain} <span className="font-mono">{item.count}</span>
                </p>
              ))}
            </div>
            <div>
              <p className="mb-1 font-medium">Orphaned Tags</p>
              {summary.advanced.orphanedTags.length === 0 ? (
                <p className="text-xs text-muted-foreground">No orphaned tags</p>
              ) : (
                summary.advanced.orphanedTags.map((item) => (
                  <p key={item.tag} className="text-xs text-muted-foreground">
                    {item.tag} <span className="font-mono">{item.count}</span>
                  </p>
                ))
              )}
            </div>
            <div>
              <p className="mb-1 font-medium">Largest Collections</p>
              {summary.advanced.largestCollections.map((item) => (
                <p key={item.tag} className="text-xs text-muted-foreground">
                  {item.tag} <span className="font-mono">{item.count}</span>
                </p>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Bookmark Debt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-mono text-3xl font-semibold tabular-nums">
              {summary.bookmarkDebt.total}
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.bookmarkDebt.unprocessed} unprocessed ·{" "}
              {summary.bookmarkDebt.broken} broken ·{" "}
              {summary.bookmarkDebt.duplicates} duplicates ·{" "}
              {summary.bookmarkDebt.stale} stale
            </p>
            <p className="text-xs text-muted-foreground">
              Estimated cleanup time: {summary.bookmarkDebt.estimatedCleanupMinutes}{" "}
              minutes
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
