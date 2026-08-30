import type { APIRoute } from "astro"

import { fetchTextSafely } from "@/lib/safe-fetch"

type SummarizeSourceResponse = {
  data?: {
    url: string
    title: string
    content: string
  }
  error?: string
}

function jsonResponse(body: SummarizeSourceResponse, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })
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
    .replace(/&nbsp;/gi, " ")
}

function stripNoiseBlocks(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
}

function getMainHtml(html: string) {
  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)
  if (articleMatch?.[1]) {
    return articleMatch[1]
  }

  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)
  if (mainMatch?.[1]) {
    return mainMatch[1]
  }

  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
  if (bodyMatch?.[1]) {
    return bodyMatch[1]
  }

  return html
}

function htmlToText(html: string) {
  const cleaned = stripNoiseBlocks(getMainHtml(html))

  return decodeHtmlEntities(
    cleaned
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<li\b[^>]*>/gi, "\n- ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function extractTitle(html: string, pageUrl: URL) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = decodeHtmlEntities(titleMatch?.[1] ?? "").trim()
  if (title) {
    return title
  }

  const segment = pageUrl.pathname.split("/").filter(Boolean).at(-1)
  return segment ? decodeURIComponent(segment) : pageUrl.hostname
}

function truncateContent(content: string, maxLength: number) {
  if (content.length <= maxLength) {
    return content
  }

  const candidate = content.slice(0, maxLength)
  const lastWord = candidate.lastIndexOf(" ")
  if (lastWord <= 0) {
    return `${candidate}...`
  }

  return `${candidate.slice(0, lastWord)}...`
}

export const GET: APIRoute = async ({ request, locals }) => {
  if (!locals.userId) {
    return jsonResponse({ error: "Unauthorized" }, 401)
  }

  const requestUrl = new URL(request.url)
  const targetUrl = parseAndValidateUrl(requestUrl.searchParams.get("url"))

  if (!targetUrl) {
    return jsonResponse({ error: "Invalid URL." }, 400)
  }

  try {
    const response = await fetchTextSafely(targetUrl.toString(), {
      timeoutMs: 10000,
      maxBytes: 256 * 1024,
      maxRedirects: 3,
      headers: {
        "user-agent": "HarborMarksBot/1.0 (+summary-fetch)",
        accept: "text/html, text/plain;q=0.9, */*;q=0.2",
      },
    })

    if (!response.ok) {
      return jsonResponse({ error: "Unable to fetch page content." }, 502)
    }

    const contentType = response.contentType.toLowerCase()
    const rawContent = response.text

    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      return jsonResponse(
        { error: "No readable content found on this page." },
        422
      )
    }

    const plainText = contentType.includes("text/plain")
      ? rawContent.trim()
      : htmlToText(rawContent)

    if (!plainText) {
      return jsonResponse(
        { error: "No readable content found on this page." },
        422
      )
    }

    const title = extractTitle(rawContent, targetUrl)
    return jsonResponse({
      data: {
        url: targetUrl.toString(),
        title,
        content: truncateContent(plainText, 15000),
      },
    })
  } catch {
    return jsonResponse({ error: "Unable to fetch page content." }, 502)
  }
}
