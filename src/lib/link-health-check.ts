// Story 14 — broken link monitoring: in-process scheduler that periodically
// checks saved bookmarks and updates their `link_health` column.
//
// Configuration (all optional, all env-only):
//   HARBOR_LINK_HEALTH_ENABLED   — "true" to run the scheduler (default: false)
//   HARBOR_LINK_HEALTH_HOUR      — UTC hour to run the daily scan (default: 2)
//   HARBOR_LINK_HEALTH_BATCH     — bookmarks to check per tick (default: 5)
//   HARBOR_LINK_HEALTH_DELAY_MS  — pause between requests in ms (default: 2000)

import { and, eq, isNull, lt, or } from "drizzle-orm"

import { bookmarks } from "@/db/schema"

// NOTE: `db`, `ensureAuthSchema`, and `isMailerConfigured` are imported lazily
// inside the functions that need them so the pure helpers above remain
// importable in unit tests without DATABASE_URL configured.

// ── Configuration ────────────────────────────────────────────────────────────

function readEnv(name: string, fallback: string): string {
  if (typeof process !== "undefined" && process.env[name]) {
    return process.env[name]!
  }
  return fallback
}

// Read env lazily (per tick/batch) so tests and runtime env changes take
// effect without a module reload. The exported constants below preserve the
// startup-time values for backwards compatibility.
export function getLinkHealthConfig(): {
  enabled: boolean
  hour: number
  batch: number
  delayMs: number
} {
  return {
    enabled: readEnv("HARBOR_LINK_HEALTH_ENABLED", "false") === "true",
    hour: Math.max(
      0,
      Math.min(
        23,
        Number.parseInt(readEnv("HARBOR_LINK_HEALTH_HOUR", "2"), 10) || 2
      )
    ),
    batch: Math.max(
      1,
      Number.parseInt(readEnv("HARBOR_LINK_HEALTH_BATCH", "5"), 10) || 5
    ),
    delayMs: Math.max(
      0,
      Number.parseInt(readEnv("HARBOR_LINK_HEALTH_DELAY_MS", "2000"), 10) ||
        2000
    ),
  }
}

// Bookmarks marked `ok` are re-checked after this long so healthy links don't
// go stale forever.
const STALE_OK_AFTER_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// ── Health check ─────────────────────────────────────────────────────────────

export function classifyLinkHealthResponse(status: number): boolean {
  if (!Number.isFinite(status)) {
    return false
  }

  // Treat all 2xx and 3xx responses as healthy for the purpose of a broken-link
  // indicator. Only 4xx/5xx and network failures are considered broken.
  return status >= 200 && status < 400
}

export function syncBrokenTagState(
  tags: string[] | null | undefined,
  healthy: boolean
): string[] {
  const uniqueTags = Array.from(
    new Set(
      (tags ?? [])
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  )

  const nonBrokenTags = uniqueTags.filter(
    (tag) => tag.toLowerCase() !== "broken"
  )

  if (healthy) {
    return nonBrokenTags
  }

  return [...nonBrokenTags, "broken"]
}

/**
 * Check a single bookmark's URL and update its link_health column.
 *
 * Uses a HEAD request first (fast path). If HEAD returns 405 Method Not
 * Allowed, falls back to GET with early abort (followRedirect: "manual"
 * avoids following redirects that would blow the timeout).
 */
async function checkUrl(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000) // 10s timeout
  try {
    // HEAD first (fast).
    const headRes = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "manual",
      headers: {
        "User-Agent": "HarborMarks-BrokenLinkChecker/1.0",
      },
    })

    if (classifyLinkHealthResponse(headRes.status)) {
      return true
    }

    // 405 on HEAD → fall back to GET.
    if (headRes.status === 405) {
      const getController = new AbortController()
      const getTimer = setTimeout(() => getController.abort(), 10_000)
      try {
        const getRes = await fetch(url, {
          method: "GET",
          signal: getController.signal,
          redirect: "manual",
          headers: {
            "User-Agent": "HarborMarks-BrokenLinkChecker/1.0",
          },
        })

        return classifyLinkHealthResponse(getRes.status)
      } finally {
        clearTimeout(getTimer)
      }
    }

    return false
  } catch {
    // Network error, DNS failure, abort, etc. → broken.
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Update one bookmark's link_health and tags based on the check result.
 * Single atomic write: read current tags first, then persist both columns.
 */
async function updateBookmarkHealth(
  bookmarkId: number,
  healthy: boolean
): Promise<void> {
  const { db } = await import("@/db/client")
  const linkHealth = healthy ? "ok" : "broken"

  // Maintain the "broken" tag alongside the column so it appears in tag
  // filters and the dashboard tag cloud without duplicating values as the
  // scheduler re-checks stale links.
  const current = await db
    .select({ tags: bookmarks.tags })
    .from(bookmarks)
    .where(eq(bookmarks.id, bookmarkId))
    .limit(1)

  const nextTags = syncBrokenTagState(current[0]?.tags ?? [], healthy)

  await db
    .update(bookmarks)
    .set({
      linkHealth,
      tags: nextTags,
      updatedAt: new Date(),
    })
    .where(eq(bookmarks.id, bookmarkId))
}

/**
 * Scan a batch of unchecked bookmarks and update their health status.
 *
 * Returns the number of bookmarks that were actually checked (healthy or not).
 */
export async function checkLinkHealthBatch(): Promise<{
  checked: number
  healthy: number
  broken: number
}> {
  await (await import("@/lib/auth")).ensureAuthSchema()
  const { batch: batchSize, delayMs } = getLinkHealthConfig()
  const { db } = await import("@/db/client")

  // Pick bookmarks that haven't been checked yet (unknown), were previously
  // marked broken (to re-verify), got stuck in `checking` after a crash, or
  // were marked `ok` long ago and deserve a re-check.
  const staleOkBefore = new Date(Date.now() - STALE_OK_AFTER_MS)
  const rows = await db
    .select({
      id: bookmarks.id,
      url: bookmarks.url,
    })
    .from(bookmarks)
    .where(
      and(
        isNull(bookmarks.deletedAt),
        or(
          eq(bookmarks.linkHealth, "unknown"),
          eq(bookmarks.linkHealth, "broken"),
          eq(bookmarks.linkHealth, "checking"),
          and(
            eq(bookmarks.linkHealth, "ok"),
            lt(bookmarks.updatedAt, staleOkBefore)
          )
        )
      )
    )
    .orderBy(bookmarks.createdAt)
    .limit(batchSize)

  if (rows.length === 0) {
    return { checked: 0, healthy: 0, broken: 0 }
  }

  let healthy = 0
  let broken = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    await db
      .update(bookmarks)
      .set({ linkHealth: "checking", updatedAt: new Date() })
      .where(eq(bookmarks.id, row.id))

    const isHealthy = await checkUrl(row.url)

    await updateBookmarkHealth(row.id, isHealthy)

    if (isHealthy) {
      healthy += 1
    } else {
      broken += 1
    }

    // Be polite to external servers.
    if (delayMs > 0 && i < rows.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return { checked: rows.length, healthy, broken }
}

// ── Scheduler ────────────────────────────────────────────────────────────────

const HEALTH_CHECK_INTERVAL_MS = 60 * 1000 // check every minute for due ticks
let healthTimer: ReturnType<typeof setInterval> | null = null
let healthSchedulerStarted = false

/**
 * Run a single health-check tick if the configured UTC hour matches the
 * current time. Returns the result (or { checked: 0 } if not due).
 */
export async function runLinkHealthTick(
  now: Date = new Date()
): Promise<{ checked: number; healthy: number; broken: number }> {
  const { hour } = getLinkHealthConfig()
  const currentHour = now.getUTCHours()

  if (currentHour !== hour) {
    return { checked: 0, healthy: 0, broken: 0 }
  }

  const result = await checkLinkHealthBatch()

  if (result.checked > 0) {
    console.log(
      `[link-health] ${hour}:00 UTC tick: ${result.checked} checked, ${result.healthy} healthy, ${result.broken} broken`
    )
  }

  return result
}

/**
 * Start the in-process link health scheduler. Mirrors the digest scheduler
 * pattern: an interval that checks whether the configured hour has arrived,
 * then runs a batch.
 */
export function scheduleLinkHealthCheck(): void {
  if (healthSchedulerStarted) {
    return
  }
  healthSchedulerStarted = true

  if (!getLinkHealthConfig().enabled) {
    console.log("[link-health] disabled (set HARBOR_LINK_HEALTH_ENABLED=true)")
    return
  }

  void import("@/lib/mailer")
    .then((mailer) => {
      if (!mailer.isMailerConfigured()) {
        console.warn(
          "[link-health] mailer not configured — health checks still run, but digest emails won't send"
        )
      }
    })
    .catch(() => {})

  // Startup catch-up: if the process started during the configured hour,
  // run immediately so the user doesn't wait a full interval.
  void runLinkHealthTick(new Date()).catch((error) => {
    console.error("[link-health] startup tick failed", error)
  })

  healthTimer = setInterval(() => {
    void runLinkHealthTick(new Date()).catch((error) => {
      console.error("[link-health] scheduled tick failed", error)
    })
  }, HEALTH_CHECK_INTERVAL_MS)

  healthTimer.unref?.()
}

/**
 * Reset the scheduler state (for testing).
 */
export function resetLinkHealthSchedulerForTests(): void {
  if (healthTimer) {
    clearInterval(healthTimer)
    healthTimer = null
  }
  healthSchedulerStarted = false
}
