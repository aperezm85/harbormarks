import type { APIRoute } from "astro"

import { getCollectionHealthSummary } from "@/lib/bookmarks"

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  const data = await getCollectionHealthSummary(locals.userId)

  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  })
}
