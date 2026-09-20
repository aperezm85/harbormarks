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
import {
  DIGEST_DEFAULT_DAY,
  DIGEST_DEFAULT_TIME,
  isDigestDay,
  isDigestDueForSchedule,
  isDigestTime,
  normalizeDigestDay,
  normalizeDigestTime,
} from "@/lib/digest-schedule"
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

// Re-exported so existing importers (e.g. the digest preferences API) keep
// working against @/lib/digest; the implementations live in the DB-free
// ./digest-schedule module for unit testing.
export {
  DIGEST_DEFAULT_DAY,
  DIGEST_DEFAULT_TIME,
  digestTimeToMinutes,
  isDigestDay,
  isDigestDueForSchedule,
  isDigestTime,
  normalizeDigestDay,
  normalizeDigestTime,
} from "@/lib/digest-schedule"

export const DIGEST_MAX_ITEMS = 50

export type DigestPreference = {
  enabled: boolean
  scope: DigestScope
  sendDay: number
  sendTime: string
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
      sendDay: digestPreferences.sendDay,
      sendTime: digestPreferences.sendTime,
      lastSentAt: digestPreferences.lastSentAt,
    })
    .from(digestPreferences)
    .where(eq(digestPreferences.userId, userId))
    .limit(1)
  if (!row) {
    return {
      enabled: false,
      scope: "unread_7d",
      sendDay: DIGEST_DEFAULT_DAY,
      sendTime: DIGEST_DEFAULT_TIME,
      lastSentAt: null,
    }
  }
  return {
    enabled: row.enabled,
    scope: normalizeScope(row.scope),
    sendDay: normalizeDigestDay(row.sendDay),
    sendTime: normalizeDigestTime(row.sendTime),
    lastSentAt: row.lastSentAt ? row.lastSentAt.toISOString() : null,
  }
}

export async function setDigestPreference(
  userId: number,
  input: { enabled?: boolean; scope?: unknown; sendDay?: unknown; sendTime?: unknown }
): Promise<DigestPreference> {
  await ensureAuthSchema()
  const scope = normalizeScope(input.scope ?? "unread_7d")
  if (input.scope !== undefined && !isDigestScope(input.scope)) {
    throw new Error("Invalid digest scope")
  }
  if (input.sendDay !== undefined && !isDigestDay(input.sendDay)) {
    throw new Error("Invalid send day (expected 0-6, Sunday-Saturday)")
  }
  if (input.sendTime !== undefined && !isDigestTime(input.sendTime)) {
    throw new Error("Invalid send time (expected HH:MM, 00:00-23:59)")
  }
  const enabled = input.enabled ?? true
  const sendDay = normalizeDigestDay(input.sendDay ?? DIGEST_DEFAULT_DAY)
  const sendTime = normalizeDigestTime(input.sendTime ?? DIGEST_DEFAULT_TIME)
  // Preserve existing day/time when caller only updates enabled/scope.
  const current = await getDigestPreference(userId)
  const nextDay = input.sendDay === undefined ? current.sendDay : sendDay
  const nextTime = input.sendTime === undefined ? current.sendTime : sendTime
  const nextScope = input.scope === undefined ? current.scope : scope
  const nextEnabled = input.enabled ?? current.enabled ?? enabled
  await db
    .insert(digestPreferences)
    .values({ userId, enabled: nextEnabled, scope: nextScope, sendDay: nextDay, sendTime: nextTime, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: digestPreferences.userId,
      set: { enabled: nextEnabled, scope: nextScope, sendDay: nextDay, sendTime: nextTime, updatedAt: new Date() },
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
  // Update-only: never reset the user's schedule (sendDay/sendTime/scope).
  // Auto-run only touches rows that already exist (due query), so an
  // update is sufficient; fall back to insert for safety.
  const updated = await db
    .update(digestPreferences)
    .set({ lastSentAt: new Date(), updatedAt: new Date() })
    .where(eq(digestPreferences.userId, userId))
    .returning({ userId: digestPreferences.userId })
  if (updated.length === 0) {
    await db
      .insert(digestPreferences)
      .values({ userId, enabled: true, scope: "unread_7d", lastSentAt: new Date() })
      .onConflictDoUpdate({
        target: digestPreferences.userId,
        set: { lastSentAt: new Date(), updatedAt: new Date() },
      })
  }
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
  return { status: "sent", count: rows.length }
}

// Weekly run: every opted-in user whose automatic digest has not gone out in
// the last ~6 days gets one email. Manual "Send now" never updates lastSentAt,
// so it never blocks the automatic Sunday send. The caller decides when a
// "week" starts (the in-process scheduler below uses Sunday morning; the
// cron-secret endpoint lets operators pick their own cadence).
export async function runWeeklyDigest(opts?: {
  baseUrl?: string
}): Promise<{ sent: number; empty: number; skipped: number }> {
  await ensureAuthSchema()
  if (!isMailerConfigured()) {
    console.warn("[digest] mailer not configured — skipping weekly run")
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
        await touchDigestSentAt(row.userId)
        sent += 1
      } else if (result.status === "empty") {
        await touchDigestSentAt(row.userId)
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

const DIGEST_CHECK_INTERVAL_MS = 60 * 1000
let digestTimer: ReturnType<typeof setInterval> | null = null
let digestSchedulerStarted = false

export async function runDueDigests(
  now: Date = new Date(),
  opts?: { baseUrl?: string }
): Promise<{ sent: number; empty: number; skipped: number }> {
  await ensureAuthSchema()
  if (!isMailerConfigured()) {
    return { sent: 0, empty: 0, skipped: 0 }
  }
  const rows = await db
    .select({
      userId: digestPreferences.userId,
      sendDay: digestPreferences.sendDay,
      sendTime: digestPreferences.sendTime,
      lastSentAt: digestPreferences.lastSentAt,
    })
    .from(digestPreferences)
    .where(eq(digestPreferences.enabled, true))
  let sent = 0
  let empty = 0
  let skipped = 0
  for (const row of rows) {
    if (!isDigestDueForSchedule(now, row.sendDay ?? 0, row.sendTime ?? DIGEST_DEFAULT_TIME, row.lastSentAt)) {
      continue
    }
    try {
      const result = await sendDigestForUser(row.userId, { baseUrl: opts?.baseUrl })
      if (result.status === "sent") {
        await touchDigestSentAt(row.userId)
        sent += 1
      } else if (result.status === "empty") {
        await touchDigestSentAt(row.userId)
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

function runDueTick(label: string) {
  void runDueDigests(new Date(), { baseUrl: resolveAppBaseUrl() })
    .then((result) => {
      if (result.sent + result.empty + result.skipped > 0) {
        console.log(
          `[digest] ${label}: ${result.sent} sent, ${result.empty} empty, ${result.skipped} skipped`
        )
      }
    })
    .catch((error) => {
      console.error(`[digest] ${label} failed`, error)
    })
}

export function scheduleDigest() {
  if (digestSchedulerStarted) {
    return
  }
  digestSchedulerStarted = true

  if (!isMailerConfigured()) {
    console.warn("[digest] mailer not configured — weekly digest will not run")
  } else {
    // Startup catch-up: if the process (re)started after a user's send time
    // today, they still get their email instead of waiting a week.
    runDueTick("startup catch-up run")
  }

  digestTimer = setInterval(() => {
    runDueTick("scheduled run")
  }, DIGEST_CHECK_INTERVAL_MS)
  digestTimer.unref?.()
}

export function resetDigestSchedulerForTests() {
  if (digestTimer) {
    clearInterval(digestTimer)
    digestTimer = null
  }
  digestSchedulerStarted = false
}
