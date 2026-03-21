import type { APIRoute } from "astro"

type BookmarkMetadata = {
  title: string
  description: string
  favicon: string
  previewImage: string | null
}

type PartialBookmarkMetadata = Partial<BookmarkMetadata>

function createJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })
}

function humanizePathname(pathname: string) {
  const lastSegment = pathname.split("/").filter(Boolean).at(-1)
  if (!lastSegment) {
    return "Untitled"
  }

  const withoutId = lastSegment.replace(/-[a-f\d]{8,}$/i, "")
  const normalized = decodeURIComponent(withoutId).replace(/[-_]+/g, " ").trim()

  if (!normalized) {
    return "Untitled"
  }

  return normalized
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function buildFallbackMetadata(pageUrl: URL): BookmarkMetadata {
  return {
    title: humanizePathname(pageUrl.pathname),
    description: "",
    favicon: new URL("/favicon.ico", pageUrl).toString(),
    previewImage: null,
  }
}

function isBotChallengePage(html: string) {
  const normalizedHtml = html.toLowerCase()
  return (
    normalizedHtml.includes("just a moment") &&
    normalizedHtml.includes("__cf_chl_opt")
  )
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

function stripHtmlTags(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function extractXmlTagValue(xml: string, tagName: string) {
  const match = xml.match(
    new RegExp(
      `<${tagName}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tagName}>`,
      "i"
    )
  )

  return decodeHtmlEntities(match?.[1] ?? "")
}

function normalizePathname(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "")
  return normalized || "/"
}

function extractPostId(pathname: string) {
  const match = normalizePathname(pathname).match(/-([a-f\d]{8,})$/i)
  return match?.[1]?.toLowerCase() ?? null
}

function buildMetadataFromFallbacks(
  fallback: BookmarkMetadata,
  metadata?: PartialBookmarkMetadata | null
): BookmarkMetadata {
  const title = metadata?.title?.trim() || fallback.title
  const description = metadata?.description?.trim() || fallback.description
  const favicon = metadata?.favicon?.trim() || fallback.favicon
  const previewImage = metadata?.previewImage?.trim() || null

  return {
    title,
    description,
    favicon,
    previewImage,
  }
}

async function fetchMetadataFromFeed(pageUrl: URL) {
  const feedUrl = new URL("/feed", pageUrl)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(feedUrl.toString(), {
      signal: controller.signal,
      headers: {
        "user-agent": "HarborMarksBot/1.0 (+metadata-fetch)",
      },
    })

    if (!response.ok) {
      return null
    }

    const xml = await response.text()
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []
    const targetPathname = normalizePathname(pageUrl.pathname)
    const targetId = extractPostId(pageUrl.pathname)

    for (const item of items) {
      const linkRaw = extractXmlTagValue(item, "link")
      const guidRaw = extractXmlTagValue(item, "guid")

      let linkPathname: string | null = null
      try {
        linkPathname = normalizePathname(new URL(linkRaw).pathname)
      } catch {
        linkPathname = null
      }

      let linkId: string | null = null
      if (linkPathname) {
        linkId = extractPostId(linkPathname)
      }

      const guidId =
        guidRaw.match(/([a-f\d]{8,})$/i)?.[1]?.toLowerCase() ?? null
      const matchesPath = linkPathname === targetPathname
      const matchesId = Boolean(
        targetId && (targetId === linkId || targetId === guidId)
      )

      if (!matchesPath && !matchesId) {
        continue
      }

      const descriptionHtml = extractXmlTagValue(item, "description")
      const snippetMatch = descriptionHtml.match(
        /<p[^>]+class=["']medium-feed-snippet["'][^>]*>([\s\S]*?)<\/p>/i
      )
      const imageMatch = descriptionHtml.match(
        /<img[^>]+src=["']([^"']+)["'][^>]*>/i
      )
      const title = extractXmlTagValue(item, "title")
      const description = stripHtmlTags(snippetMatch?.[1] ?? descriptionHtml)
      const previewImage = imageMatch?.[1] ?? null

      return {
        title,
        description,
        previewImage,
      } satisfies PartialBookmarkMetadata
    }

    return null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
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
    return createJsonResponse({ error: "Invalid or missing url" }, 400)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  const fallbackMetadata = buildFallbackMetadata(url)

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "user-agent": "HarborMarksBot/1.0 (+metadata-fetch)",
      },
    })

    if (!response.ok) {
      const feedMetadata = await fetchMetadataFromFeed(url)
      return createJsonResponse({
        data: buildMetadataFromFallbacks(fallbackMetadata, feedMetadata),
      })
    }

    const html = await response.text()
    if (isBotChallengePage(html)) {
      const feedMetadata = await fetchMetadataFromFeed(url)
      return createJsonResponse({
        data: buildMetadataFromFallbacks(fallbackMetadata, feedMetadata),
      })
    }

    const metadata: BookmarkMetadata = {
      title: extractTitle(html) || fallbackMetadata.title,
      description: extractDescription(html),
      favicon: extractFavicon(html, url) || fallbackMetadata.favicon,
      previewImage: extractPreviewImage(html, url),
    }

    return createJsonResponse({ data: metadata })
  } catch {
    const feedMetadata = await fetchMetadataFromFeed(url)
    return createJsonResponse({
      data: buildMetadataFromFallbacks(fallbackMetadata, feedMetadata),
    })
  } finally {
    clearTimeout(timeout)
  }
}
