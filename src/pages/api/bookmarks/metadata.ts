import type { APIRoute } from "astro"

type BookmarkMetadata = {
  title: string
  description: string
  favicon: string
  previewImage: string | null
}

function parseAndValidateUrl(value: string | null) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const hasProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed)
  const normalizedValue = hasProtocol ? trimmed : `https://${trimmed}`

  try {
    const parsed = new URL(normalizedValue)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim()
}

function extractMetaContent(html: string, query: RegExp) {
  const match = html.match(query)
  const content = match?.[1] ?? match?.[2] ?? ""

  return decodeHtmlEntities(content)
}

function extractTitle(html: string) {
  return (
    extractMetaContent(
      html,
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["'][^>]*>|<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["'][^>]*>/i
    ) ||
    extractMetaContent(
      html,
      /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']*)["'][^>]*>|<meta[^>]+content=["']([^"']*)["'][^>]+name=["']twitter:title["'][^>]*>/i
    ) ||
    extractMetaContent(html, /<title[^>]*>([^<]*)<\/title>/i)
  )
}

function extractDescription(html: string) {
  return (
    extractMetaContent(
      html,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>|<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i
    ) ||
    extractMetaContent(
      html,
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["'][^>]*>|<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["'][^>]*>/i
    ) ||
    extractMetaContent(
      html,
      /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']*)["'][^>]*>|<meta[^>]+content=["']([^"']*)["'][^>]+name=["']twitter:description["'][^>]*>/i
    )
  )
}

function extractFavicon(html: string, pageUrl: URL) {
  const iconMatch = html.match(
    /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>|<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/i
  )
  const iconHref = iconMatch?.[1] ?? iconMatch?.[2] ?? "/favicon.ico"

  try {
    return new URL(iconHref, pageUrl).toString()
  } catch {
    return new URL("/favicon.ico", pageUrl).toString()
  }
}

function extractPreviewImage(html: string, pageUrl: URL) {
  const imageMatch = html.match(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>|<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i
  )

  const imageHref =
    imageMatch?.[1] ?? imageMatch?.[2] ?? imageMatch?.[3] ?? imageMatch?.[4]

  if (!imageHref) {
    return null
  }

  try {
    return new URL(imageHref, pageUrl).toString()
  } catch {
    return null
  }
}

export const GET: APIRoute = async ({ request }) => {
  const requestUrl = new URL(request.url)
  const url = parseAndValidateUrl(requestUrl.searchParams.get("url"))

  if (!url) {
    return new Response(JSON.stringify({ error: "Invalid or missing url" }), {
      status: 400,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "user-agent": "HarborMarksBot/1.0 (+metadata-fetch)",
      },
    })

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Could not fetch target website" }),
        {
          status: 502,
          headers: {
            "content-type": "application/json",
          },
        }
      )
    }

    const html = await response.text()
    const metadata: BookmarkMetadata = {
      title: extractTitle(html),
      description: extractDescription(html),
      favicon: extractFavicon(html, url),
      previewImage: extractPreviewImage(html, url),
    }

    return new Response(JSON.stringify({ data: metadata }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    })
  } catch {
    return new Response(
      JSON.stringify({ error: "Failed to fetch metadata for this URL" }),
      {
        status: 502,
        headers: {
          "content-type": "application/json",
        },
      }
    )
  } finally {
    clearTimeout(timeout)
  }
}
