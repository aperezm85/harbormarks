import type { APIRoute } from "astro"

import { toggleFavoriteById } from "@/lib/bookmarks"

function parseId(rawId: string | undefined) {
  const id = Number(rawId)

  if (!Number.isInteger(id) || id <= 0) {
    return null
  }

  return id
}

function isJsonRequest(contentType: string | null) {
  return contentType?.includes("application/json") === true
}

export const POST: APIRoute = async ({ params, request, redirect }) => {
  const id = parseId(params.id)
  const wantsJson = isJsonRequest(request.headers.get("content-type"))

  if (!id) {
    if (wantsJson) {
      return new Response(JSON.stringify({ error: "Invalid bookmark id" }), {
        status: 400,
        headers: {
          "content-type": "application/json",
        },
      })
    }

    return redirect("/?error=invalid_bookmark_id")
  }

  const updated = await toggleFavoriteById(id)

  if (!updated && wantsJson) {
    return new Response(JSON.stringify({ error: "Bookmark not found" }), {
      status: 404,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  if (wantsJson) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  return redirect("/")
}
