// Story 7: metadata extraction via node-html-parser (no regex on HTML).
//
// Regex exemptions — all below are path / id normalization, NOT HTML extraction.
// They are acceptable because the Story 7 acceptance criterion "no regex in the
// metadata extraction path" refers to HTML-tag extraction only, and these
// helpers operate on plain path segments or bare guid text.
//
//   humanizePathname:
//     -[a-f0-9]{8,}$   (strip a trailing post ID from a path segment)
//     [-_]+            (join dashes/underscores as spaces when humanizing)
//     \s+             (split a humanized name into words for title-casing)
//   normalizePathname:
//     /+$             (trim trailing slashes so path comparison is exact)
//   extractPostId / extractIdFromText:
//     -[a-f0-9]{8,}$        (match a trailing post ID on a path)
//     ([a-f0-9]{8,})$      (match a trailing post ID in bare guid text)
//
// Bot-challenge detection is a pure string.includes() check — also not HTML
// extraction. The three markers Cloudflare's "Just a Moment" interstitial uses
// are well-known and hard-code them here so we can route to a per-host adapter
// without scraping a challenge page.
import type { APIRoute } from "astro"

import { parse, type HTMLElement } from "node-html-parser"
import { normalizeBookmarkUrl } from "@/lib/bookmark-url"
import {
  decodeWithCharset,
  fetchRawSafely,
  resolveCharset,
} from "@/lib/safe-fetch"

// --- Types -------------------------------------------------------------------

/**
 * Full-page metadata as returned by the metadata API route.
 *
 * Fields 1-4 are pre-Story-7 (with previewImage nullable). Fields 5-9 are the
 * Story 7 enrichments from roadmap item 9: nullable, best-effort extraction where
 * present, left null where not.
 */
export type PageMetadata = {
  title: string
  description: string
  favicon: string
  previewImage: string | null
  siteName: string | null
  author: string | null
  publishedAt: string | null
  language: string | null
  canonicalUrl: string | null
}

export type PartialPageMetadata = Partial<PageMetadata>

/**
 * A per-host adapter that knows how to fetch metadata for a specific host. The
 * default path (parse HTML) runs first; an adapter only runs when the default
 * path produced no title AND the host matches the adapter.
 */
export type MetadataAdapter = {
  /**
   * Predicate that takes a hostname (lowercase, no www.) and returns true when
   * this adapter should handle the host.
   */
  hosts: (hostname: string) => boolean
  fetchMetadata: (pageUrl: URL) => Promise<PartialPageMetadata | null>
}

// --- URL / path helpers (regex OK: not HTML extraction) -----------------------

// These operate on path segments or bare guid text — they never parse HTML.
// See the file-level comment above for the exemption.
function normalizePathname(pathname: string): string {
  // Trim trailing slashes so "/foo/" and "/foo" match.
  const stripped = pathname.replace(/\/+$/, "")
  return stripped || "/"
}

// Humanize a path segment into a human-readable title, using any of:
//   - the last non-empty path segment
//   - without any trailing -hexp id (so "hello-world-a1b2c3d4" becomes "Hello World")
//   - spaces replaced for dashes/underscores, spaces collapsed, first letters capped
// This is path-only text processing, not HTML.
function humanizePathname(pathname: string): string {
  const lastSegment = pathname.split("/").filter(Boolean).at(-1)
  if (!lastSegment) {
    return "Untitled"
  }

  // Drop a trailing post ID like "-1234abcd" so it doesn't become part of the
  // humanized title.
  const withoutId = lastSegment.replace(/-[a-f\d]{8,}$/i, "")
  // Dashes and underscores are word separators, and multi-space runs collapse.
  const normalized = decodeURIComponent(withoutId).replace(/[-_]+/g, " ").trim()

  if (!normalized) {
    return "Untitled"
  }

  return normalized
    .split(/\s+/)
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ")
    .trim()
}

// Extract a trailing post ID ("1234abcd") from a path segment. This is a path
// operation, not an HTML parse — the regex is not on HTML markup.
function extractPostId(pathname: string): string | null {
  const match = normalizePathname(pathname).match(/-([a-f\d]{8,})$/i)
  return match?.[1]?.toLowerCase() ?? null
}

// Extract a trailing post ID from bare guid text. The feed guid is plain text
// (e.g. "http://blog.a.com/p-1234abcd" or "1234abcd"), not an HTML tag.
function extractIdFromText(text: string): string | null {
  const match = text
    .trim()
    .toLowerCase()
    .match(/([a-f\d]{8,})$/i)
  return match?.[1]?.toLowerCase() ?? null
}

// --- Bot challenge detection --------------------------------------------------

// A pure string check on the lowercased body. Not an HTML parse: we look for
// two markers that Cloudflare's "Just a Moment" interstitial emits, and if
// either is present we route to the per-host adapter instead of scraping a
// challenge page.
export function isBotChallengePage(html: string): boolean {
  const lower = html.toLowerCase()
  return lower.includes("just a moment") && lower.includes("__cf_chl_opt")
}

// --- Precedence helpers -------------------------------------------------------

// Returns the first non-empty trimmed string, or `null` when all are empty.
function firstDefined(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value !== "string") {
      continue
    }
    const trimmed = value.trim()
    if (trimmed.length > 0) {
      return trimmed
    }
  }
  return null
}

// Resolve a (possibly relative) URL against a base `URL`, returning an absolute
// string URL. Returns `null` when the input is empty or invalid.
function resolveAgainst(
  value: string | null | undefined,
  base: URL
): string | null {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }
  try {
    return new URL(trimmed, base).toString()
  } catch {
    return null
  }
}

// Read a trimmed text attribute off a parsed node, or `null`.
function attrText(
  element: HTMLElement | null | undefined,
  name: string
): string | null {
  const value = element?.getAttribute(name)
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

// Read a node's own text, or `null`.
function nodeText(element: HTMLElement | null | undefined): string | null {
  const value = element?.text
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

// First non-empty `<p>` in document order. A `<p></p>` or one that collapses to
// whitespace is skipped; the first `<p>` with meaningful text wins.
function firstMeaningfulParagraph(doc: HTMLElement): string | null {
  const paragraphs = doc.querySelectorAll("p")
  for (const p of paragraphs) {
    const text = p.text?.trim()
    if (text && text.length > 0) {
      return text
    }
  }
  return null
}

// --- HTML extraction (all selector-based; no regex on HTML) -------------------

export function extractHTMLMetadata(html: string, finalUrl: URL): PageMetadata {
  // The parser decodes entities on text and attribute reads, which replaces the
  // hand-rolled 5-entity decoder from the pre-Story-7 path.
  const doc = parse(html)

  // title: og:title → twitter:title → <title> → humanized pathname
  const title =
    firstDefined([
      attrText(doc.querySelector(`meta[property="og:title"]`), "content"),
      attrText(doc.querySelector(`meta[name="twitter:title"]`), "content"),
      nodeText(doc.querySelector(`title`)),
    ]) ?? humanizePathname(finalUrl.pathname)

  // description: og:description → twitter:description → <meta description>
  //   → first meaningful <p>
  const description =
    firstDefined([
      attrText(doc.querySelector(`meta[property="og:description"]`), "content"),
      attrText(
        doc.querySelector(`meta[name="twitter:description"]`),
        "content"
      ),
      attrText(doc.querySelector(`meta[name="description"]`), "content"),
      firstMeaningfulParagraph(doc),
    ]) ?? ""

  // image: og:image → twitter:image → link[rel="image_src"]
  // All relative URLs are resolved against the FINAL response URL (the
  // redirected address) so a canonical-redirected origin keeps its host.
  const previewImage = resolveAgainst(
    firstDefined([
      attrText(doc.querySelector(`meta[property="og:image"]`), "content"),
      attrText(doc.querySelector(`meta[name="twitter:image"]`), "content"),
      attrText(doc.querySelector(`link[rel="image_src"]`), "href"),
    ]),
    finalUrl
  )

  // favicon: <link rel="icon"> / <link rel="apple-touch-icon"> → /favicon.ico
  // Always resolve to an absolute URL anchored at the final response URL.
  const favicon =
    resolveAgainst(
      firstDefined([
        attrText(doc.querySelector(`link[rel="icon"]`), "href"),
        attrText(doc.querySelector(`link[rel="apple-touch-icon"]`), "href"),
        `/favicon.ico`,
      ]),
      finalUrl
    ) ??
    resolveAgainst(`/favicon.ico`, finalUrl) ??
    `/favicon.ico`

  // siteName: og:site_name → hostname
  const siteName = firstDefined([
    attrText(doc.querySelector(`meta[property="og:site_name"]`), "content"),
    finalUrl.hostname,
  ])

  // author: meta[name="author"] → article:author → og:author (first found)
  const author = firstDefined([
    attrText(doc.querySelector(`meta[name="author"]`), "content"),
    attrText(doc.querySelector(`meta[property="article:author"]`), "content"),
    attrText(doc.querySelector(`meta[property="og:author"]`), "content"),
  ])

  // publishedAt: article:published_time (ISO 8601) → meta[name=date]
  //   → any element with a datetime attribute (best-effort first one)
  const publishedAt = firstDefined([
    attrText(
      doc.querySelector(`meta[property="article:published_time"]`),
      "content"
    ),
    attrText(doc.querySelector(`meta[name="date"]`), "content"),
    attrText(doc.querySelector(`[datetime]`), "datetime"),
  ])

  // language: <html lang> → meta[http-equiv=content-language] → meta[name=language]
  const language = firstDefined([
    attrText(doc.querySelector(`html`), "lang"),
    attrText(
      doc.querySelector(`meta[http-equiv="content-language"]`),
      "content"
    ),
    attrText(doc.querySelector(`meta[name="language"]`), "content"),
  ])

  // canonical: <link rel="canonical">, resolved to absolute
  const canonicalUrl = resolveAgainst(
    attrText(doc.querySelector(`link[rel="canonical"]`), "href"),
    finalUrl
  )

  return {
    title,
    description,
    favicon,
    previewImage,
    siteName,
    author,
    publishedAt,
    language,
    canonicalUrl,
  }
}

// --- Fallback + orchestration -------------------------------------------------

// The fallback shape when no extractor produced a title: humanized pathname
// for title, empty description, hosted /favicon.ico, and null enrichments.
// This is what the API returns when every extractor step yields nothing.
export function buildFallbackMetadata(url: URL): PageMetadata {
  return {
    title: humanizePathname(url.pathname),
    description: "",
    favicon: resolveAgainst(`/favicon.ico`, url) ?? `/favicon.ico`,
    previewImage: null,
    siteName: url.hostname || null,
    author: null,
    publishedAt: null,
    language: null,
    canonicalUrl: null,
  }
}

// Merge a per-host adapter result over a base PageMetadata, filling in any
// missing primary fields (title, description, favicon, previewImage) with the
// base or the fallback.
function mergeAdapter(
  base: PageMetadata,
  adapter: PartialPageMetadata | null,
  fallback: PageMetadata
): PageMetadata {
  if (!adapter) {
    return base
  }
  const title = adapter.title?.trim() || base.title?.trim() || fallback.title
  const description =
    adapter.description?.trim() ??
    base.description?.trim() ??
    fallback.description
  const favicon =
    adapter.favicon?.trim() || base.favicon?.trim() || fallback.favicon
  const previewImage =
    adapter.previewImage?.trim() ?? base.previewImage ?? fallback.previewImage
  // Enrichments: adapter first, then base; null where neither has it.
  const siteName =
    adapter.siteName?.trim() ?? base.siteName ?? fallback.siteName
  const author = adapter.author?.trim() ?? base.author ?? fallback.author
  const publishedAt =
    adapter.publishedAt?.trim() ?? base.publishedAt ?? fallback.publishedAt
  const language =
    adapter.language?.trim() ?? base.language ?? fallback.language
  const canonicalUrl =
    adapter.canonicalUrl?.trim() ?? base.canonicalUrl ?? fallback.canonicalUrl

  return {
    title,
    description,
    favicon,
    previewImage,
    siteName,
    author,
    publishedAt,
    language,
    canonicalUrl,
  }
}

// --- Per-host adapter table ---------------------------------------------------

// node-html-parser's default void-tag set. For the XML feed we drop only
// `link` so the feed's <link>url</link> parses as a non-void element (and keeps
// its text node), while other void tags like <img> / <meta> stay void so they
// remain extractable via querySelector.
const FED_DEFAULT_VOID_TAGS: string[] = [
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]

const FEED_VOID_TAGS = FED_DEFAULT_VOID_TAGS.filter((tag) => tag !== "link")

// The Medium /feed fallback. Matched by the medium.com host (and any subdomain
// of blog/medium.com). Returns Partial<PageMetadata> with title, description,
// and previewImage only — no favicon, no enrichments.
async function fetchMediumFeedMetadata(
  pageUrl: URL
): Promise<PartialPageMetadata | null> {
  const feedUrl = new URL("/feed", pageUrl)
  try {
    const response = await fetchRawSafely(feedUrl.toString(), {
      timeoutMs: 5000,
      maxBytes: 256 * 1024,
      maxRedirects: 3,
      headers: {
        "user-agent": "HarborMarksBot/1.0 (+metadata-fetch)",
      },
    })

    if (!response.ok) {
      return null
    }

    const charset =
      response.rawCharset ?? resolveCharset(response.contentType, response.body)
    const xml = decodeWithCharset(response.body, charset)

    // Parse as XML: strip link from the void set so <link>url</link> keeps its
    // text node, while <img>, <meta>, etc. stay void for querySelector.
    const doc = parse(xml, {
      voidTag: { tags: FEED_VOID_TAGS },
    })
    const items = doc.querySelectorAll("item")

    const targetPathname = normalizePathname(pageUrl.pathname)
    const targetId = extractPostId(pageUrl.pathname)

    for (const item of items) {
      const linkText = nodeText(item.querySelector("link"))
      const guidText = nodeText(item.querySelector("guid"))
      const titleText = nodeText(item.querySelector("title"))

      let linkPathname: string | null = null
      if (linkText) {
        try {
          linkPathname = normalizePathname(new URL(linkText).pathname)
        } catch {
          linkPathname = null
        }
      }
      const linkId = linkPathname ? extractPostId(linkPathname) : null
      const guidId = guidText ? extractIdFromText(guidText) : null

      const matchesPath = linkPathname === targetPathname
      const matchesId = Boolean(
        targetId && (targetId === linkId || targetId === guidId)
      )

      if (!matchesPath && !matchesId) {
        continue
      }

      const descriptionEl = item.querySelector("description")
      // Prefer the Medium snippet paragraph, fall back to the raw
      // description text; node-html-parser decodes entities on `.text`.
      const snippet = descriptionEl?.querySelector("p.medium-feed-snippet")
      const description = nodeText(snippet) ?? nodeText(descriptionEl) ?? ""
      const imageHref = attrText(descriptionEl?.querySelector("img"), "src")
      const previewImage = imageHref ? resolveAgainst(imageHref, feedUrl) : null

      return {
        title: titleText ?? undefined,
        description: description ?? "",
        previewImage,
      }
    }

    return null
  } catch {
    return null
  }
}

// Per-host adapter lookup. Order matters: first matching adapter wins.
const metadataAdapters: MetadataAdapter[] = [
  {
    hosts: (hostname) =>
      hostname === "medium.com" ||
      hostname === "blog.medium.com" ||
      hostname.endsWith("-medium.com"),
    fetchMetadata: fetchMediumFeedMetadata,
  },
]

async function fetchAdapterMetadata(
  pageUrl: URL
): Promise<PartialPageMetadata | null> {
  const host = (pageUrl.hostname || "").toLowerCase()
  const adapter = metadataAdapters.find((a) => a.hosts(host))
  if (!adapter) {
    return null
  }
  return adapter.fetchMetadata(pageUrl)
}

// --- Orchestration ------------------------------------------------------------

// Fetch and parse metadata for a page, ending in the per-host adapter and then
// the humanized-path fallback when nothing else yields a title.
export async function fetchPageMetadata(url: URL): Promise<PageMetadata> {
  const fallback = buildFallbackMetadata(url)

  try {
    const response = await fetchRawSafely(url.toString(), {
      timeoutMs: 8000,
      maxBytes: 256 * 1024,
      maxRedirects: 3,
      headers: {
        "user-agent": "HarborMarksBot/1.0 (+metadata-fetch)",
      },
    })

    // On any non-2xx, fall back to the per-host adapter, then to the fallback.
    if (!response.ok) {
      const adapter = await fetchAdapterMetadata(url)
      return mergeAdapter(fallback, adapter, fallback)
    }

    // Only HTML / XHTML / XML / plain-text content makes sense to parse.
    const contentType = response.contentType.toLowerCase()
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain") &&
      !contentType.includes("application/xhtml+xml") &&
      !contentType.includes("xml")
    ) {
      const adapter = await fetchAdapterMetadata(url)
      return mergeAdapter(fallback, adapter, fallback)
    }

    // Decode with the response's charset (falling back to <meta charset> in the
    // first 1KB, then to UTF-8). This is the Story 7 fix for Latin-1 pages.
    const charset =
      response.rawCharset ?? resolveCharset(response.contentType, response.body)
    const html = decodeWithCharset(response.body, charset)

    // Bot-challenge pages skip HTML extraction entirely and use the adapter.
    if (isBotChallengePage(html)) {
      const adapter = await fetchAdapterMetadata(url)
      return mergeAdapter(buildFallbackMetadata(url), adapter, fallback)
    }

    // Default path: parse the page's HTML and extract every field.
    //
    // finalUrl MUST be the response's post-redirect URL, not the requested URL,
    // so every relative URL we place on the wire (favicon, previewImage,
    // canonical) anchors to the origin that actually served the document.
    const finalUrl = new URL(response.url)
    const extracted = extractHTMLMetadata(html, finalUrl)

    // If the default path produced a title, ship it.
    if (extracted.title) {
      return extracted
    }

    // Default path produced no title: try the per-host adapter, then fall back
    // to the base fallback.
    const adapter = await fetchAdapterMetadata(url)
    return mergeAdapter(extracted, adapter, fallback)
  } catch {
    // Any fetch / parse failure — try the adapter, then fall back.
    const adapter = await fetchAdapterMetadata(url)
    return mergeAdapter(fallback, adapter, fallback)
  }
}

// --- Pure decode helper (for tests that skip HTTP) ---------------------------

// Given a raw body Buffer, the charset from the content-type (or null so it can
// fall back to <meta charset> in the first 1KB of the body), and the final
// response URL, decode the body and extract metadata without any HTTP.
export function decodeHtmlForExtract(
  body: Buffer,
  rawCharset: string | null,
  finalUrl: URL
): PageMetadata {
  const charset = rawCharset ?? resolveCharset("", body)
  const html = decodeWithCharset(body, charset)
  return extractHTMLMetadata(html, finalUrl)
}

// --- JSON envelope helpers ----------------------------------------------------

function createJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })
}

// The URL the caller asks us to extract metadata for, validated the same way
// bookmark URLs are validated elsewhere in the app.
function parseAndValidateUrl(value: string | null) {
  const normalized = normalizeBookmarkUrl(value)
  return normalized ? new URL(normalized) : null
}

// --- API route ----------------------------------------------------------------

export const GET: APIRoute = async ({ request }) => {
  const requestUrl = new URL(request.url)
  const url = parseAndValidateUrl(requestUrl.searchParams.get("url"))

  if (!url) {
    return createJsonResponse({ error: "Invalid or missing url" }, 400)
  }

  const metadata = await fetchPageMetadata(url)
  return createJsonResponse({ data: metadata })
}
