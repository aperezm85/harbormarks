import type { APIRoute } from "astro"

import { purgeBookmarkById } from "@/lib/bookmarks"

function parseId(rawId: string | undefined) {
  const id = Number(rawId)

  if (!Number.isInteger(id) || id <= 0) {
    return null
  }

  return id
}

export const POST: APIRoute = async ({ params, locals }) => {
  if (!locals.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  const id = parseId(params.id)

  if (!id) {
    return new Response(JSON.stringify({ error: "Invalid bookmark id" }), {
      status: 400,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  // Returns 404 for a bookmark that exists but is not in Trash, so the only way
  // to reach this path is to delete it first.
  const purged = await purgeBookmarkById(locals.userId, id)

  if (!purged) {
    return new Response(JSON.stringify({ error: "Bookmark not found" }), {
      status: 404,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  })
}
