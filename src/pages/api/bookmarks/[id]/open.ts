import type { APIRoute } from "astro"

import { and, eq, isNull, sql } from "drizzle-orm"

import { db } from "@/db/client"
import { bookmarks } from "@/db/schema"
import { ensureAuthSchema } from "@/lib/auth"
import { verifyBookmarkLink } from "@/lib/link-tokens"
import { getRequestClientIp, rateLimitRequest } from "@/lib/request-security"

function parseId(rawId: string | undefined) {
  const id = Number(rawId)

  if (!Number.isInteger(id) || id <= 0) {
    return null
  }

  return id
}

// Signed click-through for digest email links:
// GET /api/bookmarks/:id/open?sig=...
// Verifies the HMAC signature (the only auth email clicks carry), mirrors the
// in-app open (unread -> reading + one visit), then 302s to the stored
// bookmark URL. The redirect target always comes from the database, never from
// a query param, so this cannot be abused as an open redirect. Archived and
// already-reading bookmarks redirect untouched; trashed rows 404.
export const GET: APIRoute = async ({ params, request }) => {
  const rateLimit = rateLimitRequest(
    `bookmarks:open:ip:${getRequestClientIp(request)}`,
    { limit: 60, windowMs: 60 * 60 * 1000 }
  )

  if (!rateLimit.allowed) {
    return new Response("Rate limited", { status: 429 })
  }

  const id = parseId(params.id)
  const sig = new URL(request.url).searchParams.get("sig") ?? ""

  if (!id || !sig) {
    return new Response("Not found", { status: 404 })
  }

  await ensureAuthSchema()

  const [row] = await db
    .select({
      userId: bookmarks.userId,
      url: bookmarks.url,
      status: bookmarks.status,
    })
    .from(bookmarks)
    .where(and(eq(bookmarks.id, id), isNull(bookmarks.deletedAt)))
    .limit(1)

  if (!row?.userId || !/^https?:\/\//i.test(row.url)) {
    return new Response("Not found", { status: 404 })
  }

  if (!(await verifyBookmarkLink(row.userId, id, sig))) {
    return new Response("Not found", { status: 404 })
  }

  if (row.status === "unread") {
    await db
      .update(bookmarks)
      .set({
        status: "reading",
        visitCount: sql`${bookmarks.visitCount} + 1`,
        lastVisitedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(bookmarks.id, id), isNull(bookmarks.deletedAt)))
  }

  return Response.redirect(row.url, 302)
}
