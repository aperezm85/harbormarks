import { parse, type HTMLElement } from "node-html-parser"

// A parsed row, before canonicalization. A null url means the source row had no
// usable url and is reported as a failure rather than silently dropped.
export type ParsedImportRow = {
   url: string | null
   title: string | null
   description: string | null
   favicon: string | null
   previewImage: string | null
   tags: string[]
   isFavorite: boolean
   createdAt: string | null
}

export type ImportFormat = "json" | "csv" | "html" | "auto"

export type DuplicateStrategy = "skip" | "merge-tags" | "create-anyway"

export type ImportFailure = {
   line: number
   url: string | null
   reason: string
}

export type ImportParseResult = {
   rows: ParsedImportRow[]
}

function coerceString(value: unknown): string | null {
   if (value === null || value === undefined) {
     return null
   }

   return String(value)
}

// Split a tag cell or attribute: tags may be a JSON array, a comma-joined string,
// or an actual array. Whitespace-only entries are discarded.
export function parseTagList(value: string | string[] | null | undefined): string[] {
   if (!value) {
      return []
   }

   if (Array.isArray(value)) {
      return value.map((tag) => tag.trim()).filter((tag) => tag.length > 0)
   }

   const trimmed = value.trim()

   if (!trimmed) {
      return []
   }

    // Some sources (Pocket) store tags as a JSON array inside a single cell. It
    // may parse cleanly as JSON, or arrive bracket-wrapped but with unquoted
    // members (e.g. "[news, pocket]", "news; rust") that do not — in which case
    // strip the brackets and split on commas or semicolons.
   if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const inside = trimmed.slice(1, -1)

      try {
        const parsed = JSON.parse(trimmed)
          if (Array.isArray(parsed)) {
            return parseTagList(parsed)
            }
       } catch {
           // Fall through to the bracket-stripped split.
            }

      return inside
           .split(/[,;]/)
            .map((tag) => tag.trim().replace(/^"|"$/g, ""))
            .filter((tag) => tag.length > 0)
        }

   return trimmed
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
}

function parseUnixSeconds(value: string | null | undefined): string | null {
   if (value === null || value === undefined || value === "") {
      return null
   }

   const seconds = Number(value)

   if (!Number.isFinite(seconds)) {
      return null
   }

   return new Date(seconds * 1000).toISOString()
}

function parseIsoDate(value: string | null | undefined): string | null {
   if (!value) {
      return null
   }

   const time = Date.parse(value)

   if (Number.isNaN(time)) {
      return null
   }

   // Already an instant; re-emit in normalized ISO form.
   return new Date(time).toISOString()
}

function parseBoolean(value: unknown): boolean {
   if (typeof value === "boolean") {
      return value
    }

   if (value === null || value === undefined) {
      return false
   }

   return /^(1|true|yes)$/i.test(String(value).trim())
}

// --- HarborMarks JSON (the Story 4 lossless format) -------------------------

const SUPPORTED_IMPORT_VERSIONS = new Set([1])

function parseHarborMarksJson(
   content: string
): { ok: true; rows: ParsedImportRow[] } | { ok: false; error: string } {
   let parsed: unknown

   try {
      parsed = JSON.parse(content)
   } catch {
      return { ok: false, error: "The file is not valid JSON." }
   }

   if (typeof parsed !== "object" || parsed === null) {
      return { ok: false, error: "The file is not a HarborMarks export." }
   }

   const envelope = parsed as Record<string, unknown>
   const version = envelope.version

   if (
      typeof version !== "number" ||
      !SUPPORTED_IMPORT_VERSIONS.has(version)
   ) {
      return {
         ok: false,
         error:
           `Unsupported import version: ${typeof version === "number" ? version : "unknown"}. ` +
           `This format is not a recognized HarborMarks export.`,
      }
   }

   const bookmarks = envelope.bookmarks
   if (!Array.isArray(bookmarks)) {
      return { ok: false, error: "The export contains no bookmarks." }
   }

   const rows: ParsedImportRow[] = []

   for (const raw of bookmarks) {
      if (typeof raw !== "object" || raw === null) {
         continue
      }

      const record = raw as Record<string, unknown>
      rows.push({
         url: coerceString(record.url),
         title: coerceString(record.title),
         description: coerceString(record.description),
         favicon: coerceString(record.favicon),
         previewImage: coerceString(record.previewImage),
         tags: parseTagList(
            Array.isArray(record.tags)
               ? (record.tags as string[])
               : coerceString(record.tags)
         ),
         isFavorite: parseBoolean(record.isFavorite),
         createdAt: parseIsoDate(coerceString(record.createdAt)),
      })
   }

   return { ok: true, rows }
}

// --- CSV (Pocket and generic, share a header-driven parser) -----------------

 // A single-pass, RFC 4180 CSV parser: splits on commas and newlines outside of
 // quoted fields, folds doubled quotes into one, and lets a newline live inside a
 // quoted field. Built incrementally so a large file is never held in one
 // array-before-parsing.
 function parseCsvRecords(content: string): string[][] {
    const records: string[][] = []
    let fields: string[] = []
    let field = ""
    let inQuotes = false

    for (let i = 0; i < content.length; i += 1) {
       const char = content[i]

      if (inQuotes) {
        if (char === '"') {
          const next = content[i + 1]
          if (next === '"') {
            field += '"'
            i += 1
              } else {
            inQuotes = false
             }
          } else {
           field += char
            }

        continue
          }

      if (char === '"') {
        inQuotes = true
          } else if (char === ",") {
          fields.push(field)
          field = ""
          } else if (char === "\n" || char === "\r") {
          if (char === "\r" && content[i + 1] === "\n") {
            i += 1
            }

          fields.push(field)
          field = ""
          records.push(fields)
          fields = []
           } else {
            field += char
           }
          }

    if (field.length > 0 || fields.length > 0) {
      fields.push(field)
      records.push(fields)
        }

    return records
      }

    const POCKET_STATUS_OPEN = "open"

function parseCsv(content: string): ParsedImportRow[] {
    const records = parseCsvRecords(content)

    if (records.length === 0) {
       return []
    }

    const headers = records[0].map((header) =>
       header.trim().toLowerCase()
    )
   const column = (name: string) => headers.indexOf(name)
   const urlColumn = column("url")
   const titleColumn =
      column("title")
   const descriptionColumn = column("description")
   const tagsColumn = column("tags")
   const favoriteColumn = column("is_favorite")
   const timeAddedColumn = column("time_added")
   const createdColumn =
      timeAddedColumn === -1 ? column("created_at") : -1
   const statusColumn = column("status")

   const rows: ParsedImportRow[] = []

    for (let i = 1; i < records.length; i += 1) {
       const cells = records[i]

      const rawUrl = urlColumn >= 0 ? cells[urlColumn] : undefined
      // Pocket archives a bookmark but it is still a valid import.
      const status = statusColumn >= 0 ? (cells[statusColumn] ?? "").trim() : ""

      let createdAt: string | null = null

      if (timeAddedColumn >= 0) {
         createdAt = parseUnixSeconds(cells[timeAddedColumn] ?? null)
      } else if (createdColumn >= 0) {
         createdAt = parseIsoDate(cells[createdColumn] ?? null)
      }

      rows.push({
         url: rawUrl?.trim() || null,
         title: titleColumn >= 0 ? cells[titleColumn]?.trim() || null : null,
         description:
           descriptionColumn >= 0
             ? cells[descriptionColumn]?.trim() || null
             : null,
         favicon: null,
         previewImage: null,
         tags: tagsColumn >= 0 ? parseTagList(cells[tagsColumn] ?? null) : [],
         isFavorite:
           status === POCKET_STATUS_OPEN
             ? false
             : favoriteColumn >= 0 ? parseBoolean(cells[favoriteColumn]) : false,
         createdAt,
       })
   }

   return rows
}

 // --- Netscape bookmark HTML -----------------------------------------------

 // This parser flattens the <DT> wrapper, so a bookmark's <DD> description and
 // the enclosing folder <H3> headings land as siblings of the <A> in the same
 // container. A description is the run of text after the anchor up to the next
 // anchor; folders are the H3s preceding the anchor (within its DL ancestors).
 function parseNetscapeHtml(content: string): ParsedImportRow[] {
   const document = parse(content)
   const rows: ParsedImportRow[] = []

   const anchors = document.querySelectorAll("a")

   for (const anchor of anchors) {
      const href = anchor.getAttribute("href")?.trim()
      const title = anchor.text.trim() || href || null
      const tags = parseTagList(anchor.getAttribute("tags"))

      // Folder headings (H3) that enclose this bookmark contribute their names
      // to the tag list, e.g. "Dev > Rust" yields both "Dev" and "Rust".
      const enclosingFolders = collectEnclosingFolders(anchor)
      const description = collectDescription(anchor)

      const addDate = anchor.getAttribute("add_date")
      const createdAt = parseUnixSeconds(addDate)

      rows.push({
        url: href || null,
         title: href ? title : null,
         description,
         favicon: null,
         previewImage: null,
         tags: [...tags, ...enclosingFolders],
         isFavorite: false,
         createdAt,
        })
      }

    return rows
     }

 // The description is whatever text follows the anchor until the next bookmark,
 // so a following <DD> (even when flattened into text) is captured, with entities
 // already decoded by the parser.
 function collectDescription(anchor: HTMLElement): string | null {
  const container = anchor.parentNode
  if (!container) {
    return null
    }

   const children = container.childNodes
   const start = children.indexOf(anchor)
   let text = ""

   for (let i = start + 1; i < children.length; i += 1) {
       // childNodes mixes element and text nodes; the parser's own typings only
       // expose the shared members, so read them through a structural view.
      const node = children[i] as {
        tagName?: string
        text?: string
        rawText?: string
         }

      if (node.tagName && node.tagName === "A") {
        break
          }

        // Prefer the decoded text so entities in a <DD> resolve to characters.
       const chunk = node.text ?? node.rawText

      if (chunk) {
         text += chunk
            }
        }

   const trimmed = text.trim()
   return trimmed.length > 0 ? trimmed : null
    }

 // Walk the DL ancestry and the element siblings preceding the anchor; an H3 that
 // names a folder introduces it. Both the ancestor chain and the sibling walk are
 // bounded, so deep folder nesting does not overflow the stack.
 function collectEnclosingFolders(anchor: HTMLElement): string[] {
   const folders: string[] = []
   const seen = new Set<string>()

   const addHeading = (heading: HTMLElement | null | undefined) => {
     if (heading && heading.tagName === "H3") {
        const name = heading.text.trim()
        if (name && !seen.has(name)) {
          seen.add(name)
          folders.push(name)
            }
         }
       }

     // 1. H3 within ancestor containers (nested folders before flattening).
   let container = anchor.parentNode

   while (container) {
     for (const heading of container.querySelectorAll("h3")) {
        addHeading(heading)
      }

     container = container.parentNode
       }

      // 2. H3 among the preceding siblings, stopping at the previous bookmark.
   let sibling = anchor.previousElementSibling

   while (sibling) {
     if (sibling.tagName === "A") {
      break
       }

     addHeading(sibling)
     sibling = sibling.previousElementSibling
       }

   return folders.reverse()
    }

// --- Detection -------------------------------------------------------------

const NETSCAPE_SIGNATURE = /<!DOCTYPE\s+NETSCAPE-Bookmark-file/i

function looksLikeHtml(content: string): boolean {
   return (
      NETSCAPE_SIGNATURE.test(content) ||
      /<DT>\s*<A\b/i.test(content)
   )
}

function looksLikeJson(content: string): boolean {
   const trimmed = content.trim()
   return trimmed.startsWith("{") || trimmed.startsWith("[")
}

// The declared format from the request; "auto" sniffs content and filename.
export type DetectedFormat = "json" | "csv" | "html"

export function detectFormat(
   content: string,
   options: { declaredFormat?: string; filename?: string | null } = {}
): { format: DetectedFormat | null; error?: string } {
   const declared = options.declaredFormat

   if (declared && declared !== "auto") {
      if (declared === "json" || declared === "csv" || declared === "html") {
         return { format: declared }
      }

      return {
         format: null,
         error: `Unknown format "${declared}". Use json, csv, html, or auto.`,
      }
   }

   const trimmed = content.trim()
   const filename = (options.filename ?? "").toLowerCase()

   if (looksLikeHtml(content) || filename.endsWith(".html") || filename.endsWith(".htm")) {
      return { format: "html" }
   }

   if (looksLikeJson(trimmed)) {
      return { format: "json" }
   }

   if (filename.endsWith(".csv") || filename.endsWith(".json")) {
      return { format: filename.endsWith(".json") ? "json" : "csv" }
   }

   // A header line that begins with "url" is the clearest CSV signal.
   if (trimmed.startsWith("url,") || /^url\s*,/i.test(trimmed.split("\n")[0] ?? "")) {
      return { format: "csv" }
   }

   return { format: null, error: "Could not detect the file format." }
}

export function parseImportFile(
   content: string,
   options: { declaredFormat?: string; filename?: string | null } = {}
): { ok: true; result: ImportParseResult } | { ok: false; error: string } {
   const detection = detectFormat(content, options)

   if (detection.format === null) {
      return { ok: false, error: detection.error ?? "Could not detect the file format." }
   }

   if (detection.format === "html") {
      return {
         ok: true,
         result: { rows: parseNetscapeHtml(content) },
      }
   }

   if (detection.format === "json") {
      const parsed = parseHarborMarksJson(content)
      if (!parsed.ok) {
         return { ok: false, error: parsed.error }
      }
      return { ok: true, result: { rows: parsed.rows } }
   }

   return { ok: true, result: { rows: parseCsv(content) } }
}

export { parseCsv, parseNetscapeHtml, parseHarborMarksJson }
