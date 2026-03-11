import type { APIRoute } from "astro"

import { resetBookmarkVisitCountById } from "@/lib/bookmarks"

function parseId(rawId: string | undefined) {
  const id = Number(rawId)

  if (!Number.isInteger(id) || id <= 0) {
    return null
  }

  return id
}

export const POST: APIRoute = async ({ params, request, redirect }) => {
  const id = parseId(params.id)
  const isJsonRequest =
    request.headers.get("content-type")?.includes("application/json") === true

  if (!id) {
    if (isJsonRequest) {
      return new Response(JSON.stringify({ error: "Invalid bookmark id" }), {
        status: 400,
        headers: {
          "content-type": "application/json",
        },
      })
    }

    return redirect("/?error=invalid_bookmark_id")
  }

  const updated = await resetBookmarkVisitCountById(id)

  if (!updated && isJsonRequest) {
    return new Response(JSON.stringify({ error: "Bookmark not found" }), {
      status: 404,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  if (isJsonRequest) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  return redirect("/")
}
