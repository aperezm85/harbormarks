import type { APIRoute } from "astro"

import { countBookmarksByView } from "@/lib/bookmarks"

// Lightweight per-view totals for the dashboard subbar chips. Kept separate from
// the paginated list endpoint so the subbar can refresh its counts without
// re-fetching the (potentially large) bookmark rows.
export const GET: APIRoute = async ({ locals }) => {
  if (!locals.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  const data = await countBookmarksByView(locals.userId)

  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  })
}
