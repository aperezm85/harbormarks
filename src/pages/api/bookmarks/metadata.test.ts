// Story 7 A2: metadata extraction tests.
//
// Pure extraction is tested directly against `extractHTMLMetadata` /
// `decodeHtmlForExtract`, so no HTTP is opened. The bot-challenge and content
// routing paths are tested through `fetchPageMetadata` with `@/lib/safe-fetch`
// mocked — only `fetchRawSafely` is stubbed; the real `resolveCharset` /
// `decodeWithCharset` are reused via `vi.importActual`, so decode-dependent
// behaviour stays faithful.
import { describe, expect, it, vi } from "vitest"

import { fetchRawSafely } from "@/lib/safe-fetch"
import {
  buildFallbackMetadata,
  decodeHtmlForExtract,
  extractHTMLMetadata,
  fetchPageMetadata,
  isBotChallengePage,
} from "./metadata"

// fetchRawSafely is the only network boundary. Stub just that one; reuse the
// real charset decoders so the decode tests remain meaningful.
vi.mock("@/lib/safe-fetch", async () => {
  const actual = await vi.importActual("@/lib/safe-fetch")
  return {
    ...actual,
    fetchRawSafely: vi.fn(),
  }
})

// The mocked module's `fetchRawSafely` — a `vi.fn()` we arm per test.
const fetchRawMock = fetchRawSafely as unknown as {
  mockResolvedValueOnce: (value: unknown) => void
}

// Arm the stub for a single fetch resolution with a canned raw response.
function useRaw(raw: unknown) {
  fetchRawMock.mockResolvedValueOnce(raw)
}

// Build a canned raw response the way fetchRawSafely would return one.
function rawResponse(
  body: Buffer,
  options: {
    status?: number
    contentType?: string
    url?: string
    rawCharset?: string | null
  } = {}
) {
  return {
    url: options.url ?? "https://example.com/2020/my-post-1234abcd",
    status: options.status ?? 200,
    ok: (options.status ?? 200) < 300,
    contentType: options.contentType ?? "text/html; charset=utf-8",
    body,
    // rawCharset mirrors what the content-type declares; the test owns it.
    rawCharset: options.rawCharset ?? null,
  }
}

describe("extractHTMLMetadata — full Open Graph page", () => {
  it("returns every field from its highest-precedence source", () => {
    const html = `<!DOCTYPE html>
<html lang="es-ES">
<head>
<meta property="og:title" content="OG Title">
<meta name="twitter:title" content="Twitter Title">
<title>Plain Title</title>
<meta property="og:description" content="OG Description">
<meta name="twitter:description" content="Twitter Description">
<meta name="description" content="Plain Description">
<meta property="og:image" content="/media/og.png">
<meta name="twitter:image" content="/media/tw.png">
<meta property="og:site_name" content="HarborMarks">
<meta name="author" content="Jane Author">
<meta property="article:published_time" content="2020-01-02T03:04:05Z">
<meta name="date" content="2018-05-06">
<meta http-equiv="content-language" content="en-US">
<meta name="language" content="fr">
<link rel="icon" href="/icons/favicon.ico">
<link rel="apple-touch-icon" href="/icons/apple.png">
<link rel="canonical" href="/canonical/page/1234abcd">
</head>
<body>
<p></p>
<p>First meaningful paragraph</p>
</body>
</html>`
    const finalUrl = new URL("https://example.com/2020/my-post-1234abcd")

    const meta = extractHTMLMetadata(html, finalUrl)

    // title: og:title wins over twitter:title, <title>, humanized path.
    expect(meta.title).toBe("OG Title")
    // description: og:description wins.
    expect(meta.description).toBe("OG Description")
    // image: og:image wins, resolved to an absolute URL.
    expect(meta.previewImage).toBe("https://example.com/media/og.png")
    // favicon: link[rel=icon] wins over apple-touch-icon, absolute.
    expect(meta.favicon).toBe("https://example.com/icons/favicon.ico")
    // siteName: og:site_name.
    expect(meta.siteName).toBe("HarborMarks")
    // author: meta[name=author].
    expect(meta.author).toBe("Jane Author")
    // publishedAt: article:published_time.
    expect(meta.publishedAt).toBe("2020-01-02T03:04:05Z")
    // language: <html lang>.
    expect(meta.language).toBe("es-ES")
    // canonical: resolved to absolute.
    expect(meta.canonicalUrl).toBe(
      "https://example.com/canonical/page/1234abcd"
    )
  })
})

describe("extractHTMLMetadata — <title> only", () => {
  it("returns the <title> and falls back every other primary field", () => {
    const html = `<!DOCTYPE html>
<html lang="fr">
<head><title>Just A Title</title></head>
<body><p>Body paragraph</p></body>
</html>`
    const finalUrl = new URL(
      "https://blog.example.com/2020/hello-world-1234abcd"
    )

    const meta = extractHTMLMetadata(html, finalUrl)

    // title comes from the <title> element (no og/twitter).
    expect(meta.title).toBe("Just A Title")
    // No description meta, so the first meaningful <p> fills in.
    expect(meta.description).toBe("Body paragraph")
    // No image source → null.
    expect(meta.previewImage).toBeNull()
    // No icon link → resolves /favicon.ico against the final URL.
    expect(meta.favicon).toBe("https://blog.example.com/favicon.ico")
    // No og:site_name → host fallback.
    expect(meta.siteName).toBe("blog.example.com")
    // No author meta → null.
    expect(meta.author).toBeNull()
    // No published time → null.
    expect(meta.publishedAt).toBeNull()
    // No canonical → null.
    expect(meta.canonicalUrl).toBeNull()
    // language: <html lang> is present.
    expect(meta.language).toBe("fr")
  })
})

describe("extractHTMLMetadata — humanized pathname fallback", () => {
  it("derives a title from the path when no <title> is present", () => {
    const html = `<!DOCTYPE html><html><head></head><body></body></html>`
    const finalUrl = new URL(
      "https://blog.example.com/2020/hello-world-1234abcd"
    )

    // The trailing hex id is stripped, dashes become spaces, words cap.
    expect(extractHTMLMetadata(html, finalUrl).title).toBe("Hello World")
  })

  it("returns 'Untitled' for an empty pathname", () => {
    expect(
      extractHTMLMetadata("<html></html>", new URL("https://blog.example.com/"))
        .title
    ).toBe("Untitled")
  })
})

describe("extractHTMLMetadata — entity decoding", () => {
  it("decodes numeric and named entities in a title", () => {
    // &#8217; → ' (U+2019), &amp; → &, &eacute; → é.
    const html =
      "<html><head><title>Don&#8217;t &amp; &eacute;</title></head></html>"
    const meta = extractHTMLMetadata(html, new URL("https://example.com/a"))

    expect(meta.title).toBe("Don’t & é")
  })

  it("decodes entities in an attribute value", () => {
    const html =
      '<html><head><meta property="og:title" content="Tom&#8217;s &amp; Co &quot;X&quot;"></head></html>'
    const meta = extractHTMLMetadata(html, new URL("https://example.com/a"))

    expect(meta.title).toBe('Tom’s & Co "X"')
  })
})

describe("extractHTMLMetadata — relative URL resolution", () => {
  it("resolves og:image and favicon against the final response URL", () => {
    const html = `<!DOCTYPE html>
<html>
<head>
<meta property="og:image" content="/static/og.png">
<link rel="icon" href="/favicon.ico">
<link rel="canonical" href="/canonical/1234abcd">
</head>
<body></body>
</html>`
    const finalUrl = new URL("https://example.com/a/b/c?utm=1#top")

    const meta = extractHTMLMetadata(html, finalUrl)

    // Absolute-path references anchor to the origin; the base's query and
    // fragment do not leak into an absolute-path reference.
    expect(meta.previewImage).toBe("https://example.com/static/og.png")
    expect(meta.favicon).toBe("https://example.com/favicon.ico")
    expect(meta.canonicalUrl).toBe("https://example.com/canonical/1234abcd")
  })
})

describe("buildFallbackMetadata", () => {
  it("emits a humanized title, an absolute /favicon.ico, and nulls", () => {
    const url = new URL("https://blog.example.com/2020/some-post-abcdabcd")
    const meta = buildFallbackMetadata(url)

    expect(meta.title).toBe("Some Post")
    expect(meta.description).toBe("")
    expect(meta.favicon).toBe("https://blog.example.com/favicon.ico")
    expect(meta.previewImage).toBeNull()
    expect(meta.author).toBeNull()
    expect(meta.publishedAt).toBeNull()
    expect(meta.language).toBeNull()
    expect(meta.canonicalUrl).toBeNull()
  })
})

describe("decodeHtmlForExtract — Latin-1 body", () => {
  it("decodes an iso-8859-1 / windows-1252 page so accents survive", () => {
    // 0xe9 is 'é' in Latin-1 / Windows-1252; a UTF-8 decode of the same byte
    // would be mojibake.
    const latin1Body = Buffer.concat([
      Buffer.from("<html><head><title>caf", "latin1"),
      Buffer.from([0xe9]),
      Buffer.from("</title></head></html>", "latin1"),
    ])

    // Pass the charset explicitly to emulate a content-type
    // charset=iso-8859-1 (a null rawCharset makes resolveCharset fall to utf-8).
    const meta = decodeHtmlForExtract(
      latin1Body,
      "iso-8859-1",
      new URL("https://example.com/cafe")
    )

    expect(meta.title).toBe("café")
  })

  it("keeps UTF-8 accents intact when no charset is declared", () => {
    // A null rawCharset makes decodeHtmlForExtract resolve to utf-8.
    const meta = decodeHtmlForExtract(
      Buffer.from("<html><head><title>café</title></head></html>"),
      null,
      new URL("https://example.com/cafe")
    )

    expect(meta.title).toBe("café")
  })
})

describe("isBotChallengePage", () => {
  it("is true when both Cloudflare markers are present", () => {
    expect(
      isBotChallengePage(
        "<html><body>Just a moment...__cf_chl_opt = {}</body></html>"
      )
    ).toBe(true)
  })

  it("is false when only one marker is present", () => {
    expect(isBotChallengePage("<html>Just a moment</html>")).toBe(false)
    expect(isBotChallengePage("<html>__cf_chl_opt</html>")).toBe(false)
  })

  it("is case-insensitive", () => {
    expect(isBotChallengePage("JUST A MOMENT    __CF_CHL_OPT")).toBe(true)
  })
})

describe("fetchPageMetadata — routing", () => {
  it("returns the fallback for a bot-challenge page on a non-adapter host", async () => {
    useRaw(
      rawResponse(
        Buffer.from(
          "<html><body>Just a moment...__cf_chl_opt = {r: true}</body></html>",
          "utf8"
        ),
        {
          url: "https://secure.example.com/2020/sneak-1234abcd",
          contentType: "text/html; charset=utf-8",
        }
      )
    )
    const url = new URL("https://secure.example.com/2020/sneak-1234abcd")

    // No adapter for this host, so the bot-challenge path returns fallback.
    const meta = await fetchPageMetadata(url)

    expect(meta.title).toBe("Sneak")
    expect(meta.favicon).toBe("https://secure.example.com/favicon.ico")
    expect(meta.previewImage).toBeNull()
  })

  it("falls back for a non-HTML / non-XML content type without crashing", async () => {
    useRaw(
      rawResponse(Buffer.from("{}"), {
        url: "https://secure.example.com/2020/data-1234abcd",
        contentType: "application/json; charset=utf-8",
      })
    )
    const url = new URL("https://secure.example.com/2020/data-1234abcd")

    const meta = await fetchPageMetadata(url)

    // A non-HTML content type routes to the adapter; with no matching adapter
    // the humanized-path fallback is returned. No crash.
    expect(meta.title).toBe("Data")
  })

  it("ships the parsed page when it produces a title", async () => {
    useRaw(
      rawResponse(
        Buffer.from("<html><head><title>Good Title</title></head></html>"),
        {
          url: "https://blog.example.com/2020/good-4321abcd",
          contentType: "text/html; charset=utf-8",
        }
      )
    )
    const url = new URL("https://blog.example.com/2020/good-4321abcd")

    const meta = await fetchPageMetadata(url)
    expect(meta.title).toBe("Good Title")
  })
})
