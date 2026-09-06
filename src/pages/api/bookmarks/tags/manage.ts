import type { APIRoute } from "astro"

import {
  deleteBookmarkTag,
  mergeBookmarkTags,
  renameBookmarkTag,
} from "@/lib/bookmarks"

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  let body: {
    action?: unknown
    from?: unknown
    to?: unknown
    source?: unknown
    target?: unknown
    tag?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }

  try {
    if (body.action === "rename") {
      if (typeof body.from !== "string" || typeof body.to !== "string") {
        throw new Error("Rename requires from and to tags")
      }
      const updated = await renameBookmarkTag(
        locals.userId,
        body.from,
        body.to
      )
      return Response.json({ data: { updated } })
    }

    if (body.action === "merge") {
      if (typeof body.source !== "string" || typeof body.target !== "string") {
        throw new Error("Merge requires source and target tags")
      }
      const updated = await mergeBookmarkTags(
        locals.userId,
        body.source,
        body.target
      )
      return Response.json({ data: { updated } })
    }

    if (body.action === "delete") {
      if (typeof body.tag !== "string") {
        throw new Error("Delete requires a tag")
      }
      const updated = await deleteBookmarkTag(locals.userId, body.tag)
      return Response.json({ data: { updated } })
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Use rename, merge, or delete." }),
      { status: 400, headers: { "content-type": "application/json" } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unable to update tags",
      }),
      { status: 400, headers: { "content-type": "application/json" } }
    )
  }
}
