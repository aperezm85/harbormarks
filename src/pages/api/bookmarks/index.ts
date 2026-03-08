import type { APIRoute } from "astro"

import {
  createBookmark,
  listBookmarks,
  type BookmarkView,
} from "@/lib/bookmarks"

function parseBookmarkView(rawValue: string | null): BookmarkView {
  if (rawValue === "mostVisited") {
    return "mostVisited"
  }

  if (rawValue === "unorganized") {
    return "unorganized"
  }

  return "recent"
}

function isJsonRequest(contentType: string | null) {
  return contentType?.includes("application/json") === true
}

function parseAndValidateUrl(value: string | null) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null
    }

    return parsed.toString()
  } catch {
    return null
  }
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url)
  const search = url.searchParams.get("q") ?? undefined
  const onlyFavorites = url.searchParams.get("favorites") === "1"
  const view = parseBookmarkView(url.searchParams.get("view"))

  const data = await listBookmarks({
    search,
    onlyFavorites,
    view,
  })

  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  })
}

export const POST: APIRoute = async ({ request, redirect }) => {
  const contentType = request.headers.get("content-type")

  let url: string | null
  let title: string | null
  let description: string | null
  let favicon: string | null
  let tags: string[] | string | null

  if (isJsonRequest(contentType)) {
    const body = await request.json()
    url = parseAndValidateUrl(typeof body?.url === "string" ? body.url : null)
    title = typeof body?.title === "string" ? body.title : null
    description =
      typeof body?.description === "string" ? body.description : null
    favicon = typeof body?.favicon === "string" ? body.favicon : null
    tags =
      Array.isArray(body?.tags) || typeof body?.tags === "string"
        ? body.tags
        : null
  } else {
    const form = await request.formData()
    url = parseAndValidateUrl(
      typeof form.get("url") === "string" ? String(form.get("url")) : null
    )
    title =
      typeof form.get("title") === "string" ? String(form.get("title")) : null
    description =
      typeof form.get("description") === "string"
        ? String(form.get("description"))
        : null
    favicon =
      typeof form.get("favicon") === "string"
        ? String(form.get("favicon"))
        : null
    tags =
      typeof form.get("tags") === "string" ? String(form.get("tags")) : null
  }

  if (!url) {
    if (isJsonRequest(contentType)) {
      return new Response(JSON.stringify({ error: "Invalid or missing url" }), {
        status: 400,
        headers: {
          "content-type": "application/json",
        },
      })
    }

    return redirect("/?error=invalid_bookmark_url")
  }

  const bookmark = await createBookmark({
    url,
    title,
    description,
    favicon,
    tags,
  })

  if (isJsonRequest(contentType)) {
    return new Response(JSON.stringify({ data: bookmark }), {
      status: 201,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  return redirect("/")
}
