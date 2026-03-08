import type { APIRoute } from "astro"

import { toggleFavoriteById } from "@/lib/bookmarks"

function parseId(rawId: string | undefined) {
  const id = Number(rawId)

  if (!Number.isInteger(id) || id <= 0) {
    return null
  }

  return id
}

export const POST: APIRoute = async ({ params, redirect }) => {
  const id = parseId(params.id)

  if (!id) {
    return redirect("/?error=invalid_bookmark_id")
  }

  await toggleFavoriteById(id)

  return redirect("/")
}
