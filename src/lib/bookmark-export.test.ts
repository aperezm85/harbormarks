import { describe, expect, it } from "vitest"

import {
  createBookmarkExportStream,
  CSV_HEADER,
  decodeAssetUrl,
  exportContentType,
  exportFilename,
  formatCsvField,
  formatCsvRow,
  isBookmarkExportFormat,
} from "./bookmark-export"

async function collect(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []

  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
      }

    chunks.push(value)
      }

  const decoded = new TextDecoder()
  return chunks.map((chunk) => decoded.decode(chunk)).join("")
     }

describe("isBookmarkExportFormat", () => {
  it("accepts json, csv, and html", () => {
    expect(isBookmarkExportFormat("json")).toBe(true)
     expect(isBookmarkExportFormat("csv")).toBe(true)
     expect(isBookmarkExportFormat("html")).toBe(true)
      })

  it("rejects everything else", () => {
    expect(isBookmarkExportFormat("xml")).toBe(false)
     expect(isBookmarkExportFormat("")).toBe(false)
     expect(isBookmarkExportFormat(null)).toBe(false)
     expect(isBookmarkExportFormat(undefined)).toBe(false)
      })
})

describe("decodeAssetUrl", () => {
  it("passes a non-proxy URL through unchanged", () => {
    expect(decodeAssetUrl("https://example.com/i.png")).toBe(
      "https://example.com/i.png"
      )
     })

  it("decodes the proxy form back to the remote origin", () => {
    expect(
        decodeAssetUrl("/api/bookmarks/assets?url=https%3A%2F%2Fexample.com%2Fi.png")
      ).toBe("https://example.com/i.png")
  })

  it("returns null for an empty value", () => {
    expect(decodeAssetUrl(null)).toBeNull()
      })
})

describe("formatCsvField", () => {
  it("leaves a plain value unquoted", () => {
    expect(formatCsvField("hello")).toBe("hello")
      })

  it("quotes and escapes a value with a comma, quote, or newline", () => {
    expect(formatCsvField("a,b")).toBe('"a,b"')
     expect(formatCsvField('a"b')).toBe('"a""b"')
     expect(formatCsvField("a\nb")).toBe('"a\nb"')
      })
})

describe("formatCsvRow", () => {
  it("joins tags on a pipe and emits the remaining fields in order", () => {
    const row = formatCsvRow({
        url: "https://example.com/a",
         title: "Example",
         description: "desc",
         favicon: null,
         previewImage: null,
         tags: ["dev", "reading"],
         isFavorite: true,
         visitCount: 12,
         createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: null,
          lastVisitedAt: null,
          deletedAt: null,
          siteName: null,
          author: null,
          publishedAt: null,
          language: null,
          canonicalUrl: null,
           })

     expect(row).toBe(
        "https://example.com/a,Example,desc,dev|reading,true,12,2026-01-01T00:00:00.000Z,"
         )
      })

  it("quotes a title containing a comma, quote, and newline", () => {
    const row = formatCsvRow({
        url: "https://example.com/a",
         title: 'a,b "quoted"\n',
         description: null,
         favicon: null,
         previewImage: null,
         tags: [],
         isFavorite: false,
         visitCount: 0,
         createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: null,
          lastVisitedAt: null,
          deletedAt: null,
          siteName: null,
          author: null,
          publishedAt: null,
          language: null,
          canonicalUrl: null,
            })

     expect(row).toContain('"a,b ""quoted""\n' + '"')
         })
})

describe("exportContentType", () => {
  it("maps each format to a UTF-8 content type", () => {
    expect(exportContentType("json")).toBe("application/json; charset=utf-8")
     expect(exportContentType("csv")).toBe("text/csv; charset=utf-8")
     expect(exportContentType("html")).toBe("text/html; charset=utf-8")
      })
})

describe("exportFilename", () => {
  it("names the file by format and date", () => {
    expect(
        exportFilename("json", new Date("2026-08-31T10:00:00.000Z"))
      ).toBe("harbormarks-2026-08-31.json")
    expect(
        exportFilename("html", new Date("2026-08-31T10:00:00.000Z"))
      ).toBe("harbormarks-2026-08-31.html")
      })
})

describe("createBookmarkExportStream", () => {
  it("emits a valid CSV with a header row and pipe-joined tags", async () => {
    const rows = [{
      url: "https://example.com/a",
       title: "Example",
       description: "desc",
       favicon: "https://example.com/favicon.ico",
       previewImage: null,
       tags: ["dev", "reading"],
       isFavorite: false,
       visitCount: 1,
       createdAt: "2026-01-01T00:00:00.000Z",
       updatedAt: null,
       lastVisitedAt: null,
       deletedAt: null,
       siteName: "Example",
       author: null,
       publishedAt: null,
       language: null,
       canonicalUrl: null,
      }]

    async function* source() {
      yield rows[0]
       }

    const output = await collect(createBookmarkExportStream(source(), "csv"))
    expect(output).toContain(CSV_HEADER)
     expect(output).toContain("dev|reading")
      })

  it("wraps each entry in a self-contained Netscape HTML document", async () => {
     async function* source() {
       yield {
           url: "https://example.com/a",
           title: 'A "quoted" <title>',
           description: "Hi & bye",
           favicon: null,
           previewImage: null,
           tags: ["dev", "reading"],
           isFavorite: true,
           visitCount: 7,
           createdAt: "2026-03-01T00:00:00.000Z",
           updatedAt: null,
           lastVisitedAt: null,
           deletedAt: null,
           siteName: "Example",
           author: "Ada",
           publishedAt: "2020-01-01T00:00:00.000Z",
           language: "en",
           canonicalUrl: "https://example.com/a",
             }
           }

    const output = await collect(createBookmarkExportStream(source(), "html"))
    expect(output).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>')
     expect(output).toContain('TAGS="dev,reading"')
     expect(output).toContain("ADD_DATE=")
     // A title with quotes and angle brackets must be escaped, not break the doc.
    expect(output).toContain("&quot;quoted&quot;")
     expect(output).toContain("&lt;title&gt;")
     expect(output).toContain("</DL><p>")
      })

  it("streams a JSON envelope without a closing tag before every record", async () => {
     async function* source() {
       yield {
           url: "https://example.com/one",
           title: "One",
           description: null,
           favicon: null,
           previewImage: null,
           tags: [],
           isFavorite: false,
           visitCount: 0,
           createdAt: "2026-01-01T00:00:00.000Z",
           updatedAt: null,
           lastVisitedAt: null,
           deletedAt: null,
           siteName: null,
           author: null,
           publishedAt: null,
           language: null,
           canonicalUrl: null,
            }
         yield {
           url: "https://example.com/two",
           title: "Two",
           description: null,
           favicon: null,
           previewImage: null,
           tags: ["x"],
           isFavorite: false,
           visitCount: 0,
           createdAt: "2026-02-01T00:00:00.000Z",
           updatedAt: null,
           lastVisitedAt: null,
           deletedAt: null,
           siteName: "Two site",
           author: "Jane",
           publishedAt: "2021-05-04T00:00:00.000Z",
           language: "es",
           canonicalUrl: "https://example.com/canonical-two",
            }
          }

     const output = await collect(createBookmarkExportStream(source(), "json"))
     expect(output.startsWith('{"version":1')).toBe(true)
      expect(output.endsWith("]}")).toBe(true)
      expect(output).toContain('"https://example.com/one"')
      expect(output).toContain('"https://example.com/two"')
        })

  it("exports Story 7 enrichments to JSON losslessly", async () => {
     const exportedRow = {
       url: "https://example.com/rich",
       title: "Rich",
       description: null,
       favicon: null,
       previewImage: null,
       tags: ["rich"],
       isFavorite: false,
       visitCount: 0,
       createdAt: "2026-01-01T00:00:00.000Z",
       updatedAt: null,
       lastVisitedAt: null,
       deletedAt: null,
       siteName: "Example site",
       author: "Ada Lovelace",
       publishedAt: "2025-06-15T00:00:00.000Z",
       language: "en",
       canonicalUrl: "https://example.com/rich?canonical=1",
       }

     async function* source() {
       yield exportedRow
          }

     const output = await collect(createBookmarkExportStream(source(), "json"))
     const parsed = JSON.parse(output) as {
       version: number
       exportedAt: string
       bookmarks: Array<
         typeof exportedRow & {
            siteName?: string | null
            author?: string | null
            publishedAt?: string | null
            language?: string | null
            canonicalUrl?: string | null
             }
          >
        }

     expect(parsed.bookmarks[0].url).toBe(exportedRow.url)
     expect(parsed.bookmarks[0].siteName).toBe("Example site")
     expect(parsed.bookmarks[0].author).toBe("Ada Lovelace")
     expect(parsed.bookmarks[0].publishedAt).toBe(
        "2025-06-15T00:00:00.000Z"
        )
     expect(parsed.bookmarks[0].language).toBe("en")
     expect(parsed.bookmarks[0].canonicalUrl).toBe(
        "https://example.com/rich?canonical=1"
        )
        })
 })
