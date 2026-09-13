import { and, desc, eq, gte, isNull, sql } from "drizzle-orm"

import { db } from "@/db/client"
import { bookmarks, digestPreferences, users } from "@/db/schema"
import { ensureAuthSchema } from "@/lib/auth"
import {
  DIGEST_SCOPE_LABELS,
  isDigestScope,
  normalizeDigestScope,
  toDigestArticles,
  type DigestBookmark,
  type DigestScope,
} from "@/lib/digest-scope"
import { buildDigestEmail } from "@/lib/email-templates"
import { buildBookmarkOpenUrl } from "@/lib/link-tokens"
import { isMailerConfigured, resolveAppBaseUrl, sendMail } from "@/lib/mailer"

export {
  DIGEST_SCOPES,
  DIGEST_SCOPE_LABELS,
  isDigestScope,
  toDigestArticles,
  type DigestBookmark,
  type DigestScope,
} from "@/lib/digest-scope"

export const DIGEST_MAX_ITEMS = 50

export type DigestPreference = {
  enabled: boolean
  scope: DigestScope
  lastSentAt: string | null
}

function normalizeScope(value: unknown): DigestScope {
  return normalizeDigestScope(value)
}

export async function getDigestPreference(
  userId: number
): Promise<DigestPreference> {
  await ensureAuthSchema()
  const [row] = await db
    .select({
      enabled: digestPreferences.enabled,
      scope: digestPreferences.scope,
      lastSentAt: digestPreferences.lastSentAt,
    })
    .from(digestPreferences)
    .where(eq(digestPreferences.userId, userId))
    .limit(1)
  if (!row) {
    return { enabled: false, scope: "unread_7d", lastSentAt: null }
  }
  return {
    enabled: row.enabled,
    scope: normalizeScope(row.scope),
    lastSentAt: row.lastSentAt ? row.lastSentAt.toISOString() : null,
  }
}

export async function setDigestPreference(
  userId: number,
  input: { enabled?: boolean; scope?: unknown }
): Promise<DigestPreference> {
  await ensureAuthSchema()
  const scope = normalizeScope(input.scope ?? "unread_7d")
  if (input.scope !== undefined && !isDigestScope(input.scope)) {
    throw new Error("Invalid digest scope")
  }
  const enabled = input.enabled ?? true
  await db
    .insert(digestPreferences)
    .values({ userId, enabled, scope, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: digestPreferences.userId,
      set: { enabled, scope, updatedAt: new Date() },
    })
  return getDigestPreference(userId)
}

export async function getDigestBookmarks(
  userId: number,
  scope: DigestScope,
  limit: number = DIGEST_MAX_ITEMS
): Promise<DigestBookmark[]> {
  await ensureAuthSchema()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const filters = [eq(bookmarks.userId, userId), isNull(bookmarks.deletedAt)]
  if (scope === "unread_7d") {
    filters.push(eq(bookmarks.status, "unread"), gte(bookmarks.createdAt, weekAgo))
  } else if (scope === "all_unread") {
    filters.push(eq(bookmarks.status, "unread"))
  } else {
    filters.push(gte(bookmarks.createdAt, weekAgo))
  }
  const rows = await db
    .select({
      id: bookmarks.id,
      url: bookmarks.url,
      title: bookmarks.title,
      description: bookmarks.description,
      note: bookmarks.note,
      tags: bookmarks.tags,
      createdAt: bookmarks.createdAt,
    })
    .from(bookmarks)
    .where(and(...filters))
    .orderBy(desc(bookmarks.createdAt), desc(bookmarks.id))
    .limit(Math.max(1, Math.min(limit, 100)))
  return rows
}

async function touchDigestSentAt(userId: number) {
  await db
    .insert(digestPreferences)
    .values({ userId, enabled: true, scope: "unread_7d", lastSentAt: new Date() })
    .onConflictDoUpdate({
      target: digestPreferences.userId,
      set: { lastSentAt: new Date(), updatedAt: new Date() },
    })
}

export type DigestSendResult =
  | { status: "sent"; count: number }
  | { status: "empty" }
  | { status: "disabled" }
  | { status: "unconfigured" }

export async function sendDigestForUser(
  userId: number,
  opts?: { baseUrl?: string; scopeOverride?: DigestScope }
): Promise<DigestSendResult> {
  await ensureAuthSchema()
  const pref = await getDigestPreference(userId)
  if (!pref.enabled && !opts?.scopeOverride) {
    return { status: "disabled" }
  }
  if (!isMailerConfigured()) {
    return { status: "unconfigured" }
  }
  const scope = opts?.scopeOverride ?? pref.scope
  const rows = await getDigestBookmarks(userId, scope)
  if (rows.length === 0) {
    await touchDigestSentAt(userId)
    return { status: "empty" }
  }
  const [user] = await db
    .select({
      email: users.email,
      displayName: users.displayName,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!user || !user.isActive) {
    return { status: "disabled" }
  }
  const baseUrl = resolveAppBaseUrl(opts?.baseUrl)
  // Signed tracking links: clicking records unread -> reading + a visit, then
  // redirects to the saved page. articles[] and rows[] are in the same order
  // (toDigestArticles maps 1:1), so zip them by index for the bookmark ids.
  const articles = toDigestArticles(rows)
  for (const [index, row] of rows.entries()) {
    articles[index].href = await buildBookmarkOpenUrl(baseUrl, userId, row.id)
  }
  const email = buildDigestEmail({
    displayName: user.displayName,
    scopeLabel: DIGEST_SCOPE_LABELS[scope],
    articles,
    dashboardUrl: `${baseUrl}/?view=unread`,
  })
  await sendMail({ to: user.email, subject: email.subject, text: email.text, html: email.html })
  await touchDigestSentAt(userId)
  return { status: "sent", count: rows.length }
}

// Weekly run: every opted-in user whose digest has not gone out in the last
// ~6 days gets one email. The caller decides when a "week" starts (the
// in-process scheduler below uses Sunday morning; the cron-secret endpoint
// lets operators pick their own cadence).
export async function runWeeklyDigest(opts?: {
  baseUrl?: string
}): Promise<{ sent: number; empty: number; skipped: number }> {
  await ensureAuthSchema()
  if (!isMailerConfigured()) {
    return { sent: 0, empty: 0, skipped: 0 }
  }
  const cutoff = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
  const due = await db
    .select({ userId: digestPreferences.userId })
    .from(digestPreferences)
    .where(
      and(
        eq(digestPreferences.enabled, true),
        sql`(${digestPreferences.lastSentAt} is null or ${digestPreferences.lastSentAt} < ${cutoff})`
      )
    )
  let sent = 0
  let empty = 0
  let skipped = 0
  for (const row of due) {
    try {
      const result = await sendDigestForUser(row.userId, { baseUrl: opts?.baseUrl })
      if (result.status === "sent") {
        sent += 1
      } else if (result.status === "empty") {
        empty += 1
      } else {
        skipped += 1
      }
    } catch (error) {
      console.error(`[digest] send failed for user ${row.userId}`, error)
      skipped += 1
    }
  }
  return { sent, empty, skipped }
}

const DIGEST_CHECK_INTERVAL_MS = 15 * 60 * 1000
let digestTimer: ReturnType<typeof setInterval> | null = null

function shouldRunNow(now: Date): boolean {
  // Sunday (0) between 07:00 and 07:59 server-local time. The 15-minute tick
  // plus the 6-day last_sent guard make double-sends unlikely on one instance.
  // Operators wanting another slot can set HARBOR_DIGEST_CRON to a 5-field
  // cron string, but only the Sunday-morning default is evaluated in-process;
  // anything else should use POST /api/digest/run with HARBOR_CRON_SECRET.
  const override = (
    process.env.HARBOR_DIGEST_CRON ??
    (import.meta.env?.HARBOR_DIGEST_CRON as string | undefined) ??
    ""
  ).trim()
  if (override && override !== "0 7 * * 0" && override !== "sunday") {
    return false
  }
  return now.getDay() === 0 && now.getHours() === 7
}

export function scheduleDigest() {
  if (digestTimer) {
    return
  }
  digestTimer = setInterval(() => {
    if (!shouldRunNow(new Date())) {
      return
    }
    void runWeeklyDigest({
      baseUrl: resolveAppBaseUrl(),
    }).catch((error) => {
      console.error("[digest] weekly run failed", error)
    })
  }, DIGEST_CHECK_INTERVAL_MS)
  digestTimer.unref?.()
}

export function resetDigestSchedulerForTests() {
  if (digestTimer) {
    clearInterval(digestTimer)
    digestTimer = null
  }
}
