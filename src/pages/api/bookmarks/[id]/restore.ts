import type { APIRoute } from "astro"

import { restoreBookmarkById } from "@/lib/bookmarks"

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

  const restored = await restoreBookmarkById(locals.userId, id)

  if (!restored) {
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
