import type { APIRoute } from "astro"

import { incrementBookmarkVisitById } from "@/lib/bookmarks"

function parseId(rawId: string | undefined) {
  const id = Number(rawId)

  if (!Number.isInteger(id) || id <= 0) {
    return null
  }

  return id
}

export const POST: APIRoute = async ({ params }) => {
  const id = parseId(params.id)

  if (!id) {
    return new Response(JSON.stringify({ error: "Invalid bookmark id" }), {
      status: 400,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  const updated = await incrementBookmarkVisitById(id)

  if (!updated) {
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
