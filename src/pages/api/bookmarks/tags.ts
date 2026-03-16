import type { APIRoute } from "astro"

import { listBookmarkTags } from "@/lib/bookmarks"

export const GET: APIRoute = async ({ request, locals }) => {
  if (!locals.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  const url = new URL(request.url)
  const query = url.searchParams.get("q") ?? undefined

  const data = await listBookmarkTags(locals.userId, query)

  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  })
}
