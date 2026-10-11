import type { APIRoute } from "astro"

import {
  bulkUpdateBookmarks,
  isBulkBookmarksAction,
} from "@/lib/bookmarks"

const MAX_BULK_IDS = 500

function parseIds(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null
  }

  if (value.length > MAX_BULK_IDS) {
    return null
  }

  const ids: number[] = []

  for (const entry of value) {
    const id = typeof entry === "string" ? Number(entry) : entry

    if (!Number.isInteger(id) || (id as number) <= 0) {
      return null
    }

    ids.push(id as number)
  }

  return [...new Set(ids)]
}

function parseTags(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? [value] : []
  const seen = new Set<string>()
  const out: string[] = []

  for (const entry of raw) {
    if (typeof entry !== "string") {
      continue
    }

    const trimmed = entry.trim()

    if (!trimmed || trimmed.length > 50) {
      continue
    }

    const key = trimmed.toLowerCase()

    if (!seen.has(key)) {
      seen.add(key)
      out.push(trimmed)
    }

    if (out.length >= 20) {
      break
    }
  }

  return out
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  let body: {
    ids?: unknown
    action?: unknown
    tags?: unknown
  }

  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }

  if (Array.isArray(body?.ids) && body.ids.length > MAX_BULK_IDS) {
    return new Response(
      JSON.stringify({ error: "Select up to 500 bookmarks at a time" }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      }
    )
  }

  const ids = parseIds(body?.ids)

  if (!ids) {
    return new Response(JSON.stringify({ error: "Invalid bookmark ids" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }

  if (!isBulkBookmarksAction(body?.action)) {
    return new Response(JSON.stringify({ error: "Invalid bulk action" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }

  const action = body.action
  const needsTags = action === "add-tags" || action === "remove-tags"
  const tags = parseTags(body?.tags)

  if (needsTags && tags.length === 0) {
    return new Response(JSON.stringify({ error: "Tags are required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }

  try {
    const affected = await bulkUpdateBookmarks(
      locals.userId,
      ids,
      action,
      tags
    )

    return new Response(
      JSON.stringify({ data: { affected, requested: ids.length } }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    )
  } catch {
    return new Response(JSON.stringify({ error: "Unable to update bookmarks" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}
