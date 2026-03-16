import type { APIRoute } from "astro"

import { updateBookmarkById } from "@/lib/bookmarks"

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

  const bookmark = await updateBookmarkById(locals.userId, id, {
    url,
    title,
    description,
    favicon,
    previewImage,
    tags,
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
