import type { APIRoute } from "astro"

import { normalizeBookmarkUrl } from "@/lib/bookmark-url"
import {
  createBookmark,
  DEFAULT_BOOKMARK_PAGE_SIZE,
  hasDuplicateBookmarkUrl,
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

  if (rawValue === "trash") {
    return "trash"
  }

  return "recent"
}

function parsePositiveInteger(rawValue: string | null, fallback: number) {
  const parsed = Number(rawValue)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}

function isJsonRequest(contentType: string | null) {
  return contentType?.includes("application/json") === true
}

function parseAndValidateUrl(value: string | null) {
  return normalizeBookmarkUrl(value)
}

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
  const search = url.searchParams.get("q") ?? undefined
  const tag = url.searchParams.get("tag") ?? undefined
  const onlyFavorites = url.searchParams.get("favorites") === "1"
  const view = parseBookmarkView(url.searchParams.get("view"))
  const page = parsePositiveInteger(url.searchParams.get("page"), 1)
  const pageSize = Math.min(
    parsePositiveInteger(
      url.searchParams.get("pageSize"),
      DEFAULT_BOOKMARK_PAGE_SIZE
    ),
    100
  )

  const rows = await listBookmarks(locals.userId, {
    search,
    tag,
    onlyFavorites,
    view,
    page,
    pageSize: pageSize + 1,
  })

  const hasMore = rows.length > pageSize
  const data = hasMore ? rows.slice(0, pageSize) : rows

  return new Response(JSON.stringify({ data, hasMore, page, pageSize }), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  })
}

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!locals.userId) {
    if (isJsonRequest(request.headers.get("content-type"))) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          "content-type": "application/json",
        },
      })
    }

    return redirect("/login")
  }

  const contentType = request.headers.get("content-type")

  let url: string | null
  let title: string | null
  let description: string | null
  let favicon: string | null
  let previewImage: string | null
  let tags: string[] | string | null
  let isFavorite: boolean
  // Story 7 enrichments. JSON-only: initialized to null so the form path (which
  // never reads them) keeps this route's prior behavior, and the JSON path
  // overwrites with the submitted body. createBookmark applies `trim() || null`.
  let siteName: string | null = null
  let author: string | null = null
  let publishedAt: string | null = null
  let language: string | null = null
  let canonicalUrl: string | null = null

  if (isJsonRequest(contentType)) {
    const body = await request.json()
    url = parseAndValidateUrl(typeof body?.url === "string" ? body.url : null)
    title = typeof body?.title === "string" ? body.title : null
    description =
      typeof body?.description === "string" ? body.description : null
    favicon = typeof body?.favicon === "string" ? body.favicon : null
    previewImage =
      typeof body?.previewImage === "string" ? body.previewImage : null
    tags =
      Array.isArray(body?.tags) || typeof body?.tags === "string"
          ? body.tags
          : null
    isFavorite = body?.isFavorite === true
    // Pass through as-is (string or null): createBookmark applies `trim() || null`.
    siteName = typeof body?.siteName === "string" ? body.siteName : null
    author = typeof body?.author === "string" ? body.author : null
    publishedAt =
      typeof body?.publishedAt === "string" ? body.publishedAt : null
    language = typeof body?.language === "string" ? body.language : null
    canonicalUrl =
      typeof body?.canonicalUrl === "string" ? body.canonicalUrl : null
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
    previewImage =
      typeof form.get("previewImage") === "string"
        ? String(form.get("previewImage"))
        : null
    tags =
      typeof form.get("tags") === "string" ? String(form.get("tags")) : null
    isFavorite = form.get("isFavorite") === "true"
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

  if (await hasDuplicateBookmarkUrl(locals.userId, url)) {
    if (isJsonRequest(contentType)) {
      return new Response(
        JSON.stringify({ error: "A bookmark with this URL already exists" }),
        {
          status: 409,
          headers: {
            "content-type": "application/json",
          },
        }
      )
    }

    return redirect("/?error=duplicate_bookmark_url")
  }

  const bookmark = await createBookmark(locals.userId, {
    url,
    title,
    description,
    favicon,
    previewImage,
    tags,
    isFavorite,
    siteName,
    author,
    publishedAt,
    language,
    canonicalUrl,
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
