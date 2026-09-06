import type { APIRoute } from "astro"

import { normalizeBookmarkUrl } from "@/lib/bookmark-url"
import {
  findDuplicateBookmark,
  updateBookmarkById,
} from "@/lib/bookmarks"

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

function parseAndValidateUrl(value: string | null) {
  return normalizeBookmarkUrl(value)
}

export const POST: APIRoute = async ({ params, request, redirect, locals }) => {
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

  const id = parseId(params.id)

  if (!id) {
    if (isJsonRequest(request.headers.get("content-type"))) {
      return new Response(JSON.stringify({ error: "Invalid bookmark id" }), {
        status: 400,
        headers: {
          "content-type": "application/json",
        },
      })
    }

    return redirect("/?error=invalid_bookmark_id")
  }

  const contentType = request.headers.get("content-type")

  let url: string | null
  let title: string | null
  let description: string | null
  let favicon: string | null
  let previewImage: string | null
  let tags: string[] | string | null
  // Story 7 enrichments. JSON-only: left undefined on the form path, which the
  // data layer then omits from the UPDATE, keeping the form branch byte-for-byte.
  let siteName: string | null | undefined
  let author: string | null | undefined
  let publishedAt: string | null | undefined
  let language: string | null | undefined
  let canonicalUrl: string | null | undefined
  // Story 12 note. JSON-only: string-or-null from the body; the form path
  // stays undefined so the data layer omits the column.
  let note: string | null | undefined
  // Read status slice. JSON-only: validated string; undefined omits the column.
  let status: string | null | undefined
  // Favorite switch. JSON-only: boolean passthrough; undefined omits the column.
  let isFavorite: boolean | undefined

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
     // Pass through as-is (string or null): updateBookmarkById applies
     // `trim() || null` when present and omits the column when undefined.
    siteName = typeof body?.siteName === "string" ? body.siteName : null
    author = typeof body?.author === "string" ? body.author : null
    publishedAt =
      typeof body?.publishedAt === "string" ? body.publishedAt : null
    language = typeof body?.language === "string" ? body.language : null
    canonicalUrl =
      typeof body?.canonicalUrl === "string" ? body.canonicalUrl : null
    // Pass through as-is (string or null): updateBookmarkById applies
    // `trim() || null` when present and omits the column when undefined.
    note = typeof body?.note === "string" ? body.note : null
    status = typeof body?.status === "string" ? body.status : undefined
    isFavorite =
      typeof body?.isFavorite === "boolean" ? body.isFavorite : undefined
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

  const existing = await findDuplicateBookmark(locals.userId, url, id)

  if (existing) {
    if (isJsonRequest(contentType)) {
      return new Response(
        JSON.stringify({
          error: "A bookmark with this URL already exists",
          code: "duplicate_bookmark",
          existing,
        }),
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

  const bookmark = await updateBookmarkById(locals.userId, id, {
    url,
    title,
    description,
    favicon,
    previewImage,
    tags,
    siteName,
    author,
    publishedAt,
    language,
    canonicalUrl,
    note,
    status,
    isFavorite,
     })

  if (!bookmark) {
    if (isJsonRequest(contentType)) {
      return new Response(JSON.stringify({ error: "Bookmark not found" }), {
        status: 404,
        headers: {
          "content-type": "application/json",
        },
      })
    }

    return redirect("/?error=bookmark_not_found")
  }

  if (isJsonRequest(contentType)) {
    return new Response(JSON.stringify({ data: bookmark }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  return redirect("/")
}
