import type { APIRoute } from "astro"

import { isBookmarkStatus, setBookmarkStatusById } from "@/lib/bookmarks"

function parseId(rawId: string | undefined) {
  const id = Number(rawId)

  if (!Number.isInteger(id) || id <= 0) {
    return null
  }

  return id
}

export const POST: APIRoute = async ({ params, request, locals }) => {
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

  let status: unknown

  try {
    const body = await request.json()
    status = body?.status
  } catch {
    status = null
  }

  if (!isBookmarkStatus(status)) {
    return new Response(JSON.stringify({ error: "Invalid status" }), {
      status: 400,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  try {
    const updated = await setBookmarkStatusById(locals.userId, id, status)

    if (!updated) {
      return new Response(JSON.stringify({ error: "Bookmark not found" }), {
        status: 404,
        headers: {
          "content-type": "application/json",
        },
      })
    }

    return new Response(JSON.stringify({ data: updated }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    })
  } catch {
    return new Response(JSON.stringify({ error: "Invalid status" }), {
      status: 400,
      headers: {
        "content-type": "application/json",
      },
    })
  }
}
