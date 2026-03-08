import type { APIRoute } from "astro"

import { listBookmarkTags } from "@/lib/bookmarks"

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url)
  const query = url.searchParams.get("q") ?? undefined

  const data = await listBookmarkTags(query)

  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  })
}
