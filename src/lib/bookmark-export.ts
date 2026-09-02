import { isBookmarkAssetProxyUrl } from "@/lib/bookmark-assets"

export type BookmarkExportFormat = "json" | "csv" | "html"

export type BookmarkExportRow = {
  url: string
  title: string | null
  description: string | null
  favicon: string | null
  previewImage: string | null
  tags: string[]
  isFavorite: boolean
  visitCount: number
  createdAt: string
  updatedAt: string | null
  lastVisitedAt: string | null
  deletedAt: string | null
}

export const EXPORT_FORMATS = ["json", "csv", "html"] as const

function isExportFormat(value: string | null | undefined): value is BookmarkExportFormat {
  return value === "json" || value === "csv" || value === "html"
}

// A stored asset URL may be the local proxy form
// (/api/bookmarks/assets?url=<remote>). An export must carry the original remote
// origin so the file is portable to another machine; decode the proxy back out.
export function decodeAssetUrl(value: string | null): string | null {
  if (!value) {
    return null
    }

  if (isBookmarkAssetProxyUrl(value)) {
    try {
      const parsed = new URL(value, "http://localhost")
      const remote = parsed.searchParams.get("url")
      return remote && remote.length > 0 ? remote : null
     } catch {
      return null
      }
    }

  return value
}

// RFC 4180: quote a field when it carries a comma, double quote, or newline, and
// escape an embedded double quote by doubling it.
export function formatCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
   }

  return value
}

function toCsvValue(value: string | null | undefined): string {
  const text = value ?? ""
  return formatCsvField(text)
}

// Tags join on a pipe, never the comma delimiter, so a tag containing a comma
// cannot corrupt the field and no spreadsheet import mis-parses it.
export function formatCsvRow(row: BookmarkExportRow): string {
  const fields = [
     toCsvValue(row.url),
     toCsvValue(row.title),
     toCsvValue(row.description),
     formatCsvField(row.tags.join("|")),
     row.isFavorite ? "true" : "false",
     String(row.visitCount),
     toCsvValue(row.createdAt),
     toCsvValue(row.lastVisitedAt),
   ]

  return fields.join(",")
}

export const CSV_HEADER = "url,title,description,tags,is_favorite,visit_count,created_at,last_visited_at"

export function escapeHtml(value: string): string {
  return value
     .replace(/&/g, "&amp;")
     .replace(/</g, "&lt;")
     .replace(/>/g, "&gt;")
     .replace(/"/g, "&quot;")
     .replace(/'/g, "&#39;")
   }

function unixSeconds(value: string): string {
  const time = Date.parse(value)
  return Number.isNaN(time) ? "0" : String(Math.floor(time / 1000))
}

const NETSCAPE_HTML_HEADER =
  "<!DOCTYPE NETSCAPE-Bookmark-file-1>\n" +
  "<META HTTP-EQUIV=\"Content-Type\" CONTENT=\"text/html; charset=UTF-8\">\n" +
  "<TITLE>Bookmarks</TITLE>\n" +
  "<H1>Bookmarks</H1>\n" +
  "<DL><p>\n"

const NETSCAPE_HTML_FOOTER = "</DL><p>\n"

export function formatNetscapeEntry(row: BookmarkExportRow): string {
  const title = row.title ?? row.url
  const tags = row.tags.length > 0 ? ` TAGS="${escapeHtml(row.tags.join(","))}"` : ""
  const addDate = `ADD_DATE="${unixSeconds(row.createdAt)}"`
  const dd = row.description
     ? `<DD>${escapeHtml(row.description)}\n`
     : ""

  return `<DT><A HREF="${escapeHtml(row.url)}" ${addDate}${tags}>${escapeHtml(
     title
  )}</A>\n${dd}`
}

export function exportFilename(format: BookmarkExportFormat, date = new Date()): string {
  const day = date.toISOString().slice(0, 10)
  return `harbormarks-${day}.${format === "html" ? "html" : format}`
}

const EXPORT_CONTENT_TYPES: Record<BookmarkExportFormat, string> = {
  json: "application/json",
  csv: "text/csv",
  html: "text/html",
}

export function exportContentType(format: BookmarkExportFormat): string {
  return `${EXPORT_CONTENT_TYPES[format]}; charset=utf-8`
}

export function isBookmarkExportFormat(
   value: string | null | undefined
): value is BookmarkExportFormat {
   return isExportFormat(value)
}

type StreamFormat = BookmarkExportFormat

export function createBookmarkExportStream(
   source: AsyncIterable<BookmarkExportRow>,
   format: StreamFormat
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()

  if (format === "csv") {
    return new ReadableStream<Uint8Array>({
       start(controller) {
          controller.enqueue(encoder.encode(`${CSV_HEADER}\n`))
         },
       async pull(controller) {
          for await (const row of source) {
            controller.enqueue(
               encoder.encode(`${formatCsvRow(row)}\n`)
            )
          }

          controller.close()
         },
      })
    }

  if (format === "html") {
    return new ReadableStream<Uint8Array>({
       start(controller) {
          controller.enqueue(encoder.encode(NETSCAPE_HTML_HEADER))
         },
       async pull(controller) {
          for await (const row of source) {
            controller.enqueue(encoder.encode(formatNetscapeEntry(row)))
           }

          controller.enqueue(encoder.encode(NETSCAPE_HTML_FOOTER))
          controller.close()
         },
      })
    }

  // JSON: stream the envelope so a multi-thousand-row export never lives in one
  // array. The header is written once, each bookmark between its delimiters, and
  // the tail closes the array and object.
  return new ReadableStream<Uint8Array>({
     start(controller) {
        controller.enqueue(
           encoder.encode(
              `{"version":1,"exportedAt":"${new Date().toISOString()}","bookmarks":[`
           )
        )
        },
     async pull(controller) {
        let first = true

        for await (const row of source) {
          if (!first) {
            controller.enqueue(encoder.encode(","))
           }

          first = false
          controller.enqueue(encoder.encode(JSON.stringify(rowToExportRecord(row))))
         }

        controller.enqueue(encoder.encode("]}"))
        controller.close()
         },
      })
   }

function rowToExportRecord(row: BookmarkExportRow) {
   return {
     url: row.url,
     title: row.title,
     description: row.description,
     favicon: decodeAssetUrl(row.favicon),
     previewImage: decodeAssetUrl(row.previewImage),
     tags: row.tags,
     isFavorite: row.isFavorite,
     visitCount: row.visitCount,
     createdAt: row.createdAt,
     updatedAt: row.updatedAt,
     lastVisitedAt: row.lastVisitedAt,
     deletedAt: row.deletedAt,
    }
}
