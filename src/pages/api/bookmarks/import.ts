import type { APIRoute } from "astro"

import {
   type DuplicateStrategy,
   parseImportFile,
} from "@/lib/bookmark-import"
import { importBookmarks } from "@/lib/bookmarks"

const MAX_IMPORT_BYTES = 10 * 1024 * 1024

function jsonError(message: string, status: number) {
   return new Response(JSON.stringify({ error: message }), {
      status,
      headers: {
         "content-type": "application/json",
      },
    })
}

function isDuplicateStrategy(
   value: string | null | undefined
): value is DuplicateStrategy {
   return value === "skip" || value === "merge-tags" || value === "create-anyway"
}

export const POST: APIRoute = async ({ request, locals }) => {
   if (!locals.userId) {
      return jsonError("Unauthorized", 401)
    }

    // Gate by declared body size before buffering the whole upload, so an
    // oversized file fails fast instead of exhausting memory.
   const contentLength = Number(request.headers.get("content-length") ?? 0)

   if (contentLength > MAX_IMPORT_BYTES) {
      return jsonError("File exceeds the 10 MB import limit.", 413)
    }

   const contentType = request.headers.get("content-type")

   if (!contentType?.includes("multipart/form-data")) {
      return jsonError("Expected a multipart/form-data upload.", 400)
     }

   let formData: FormData

   try {
      formData = await request.formData()
      } catch {
      return jsonError("Could not read the uploaded file.", 400)
    }

   const file = formData.get("file")

     // A declared size that under-reported the body (e.g. streaming uploads with
    // no content-length) is caught here so the 10 MB cap always holds.
   if (file instanceof File && file.size > MAX_IMPORT_BYTES) {
      return jsonError("File exceeds the 10 MB import limit.", 413)
    }

    const formatValue = formData.get("format")
    const duplicatesValue = formData.get("duplicates")
    const declaredFormat =
      typeof formatValue === "string" ? formatValue : "auto"
    const declaredDuplicates =
      typeof duplicatesValue === "string" ? duplicatesValue : "skip"

    if (!isDuplicateStrategy(declaredDuplicates)) {
      return jsonError(
        "Invalid duplicates strategy. Use skip, merge-tags, or create-anyway.",
        400
        )
      }

    let content: string
    let filename: string | null

    if (file instanceof File) {
      filename = file.name || null
      content = await file.text()
        } else {
      return jsonError("No file was uploaded.", 400)
        }

    const parsed = parseImportFile(content, {
      declaredFormat,
      filename,
     })

   if (!parsed.ok) {
      return jsonError(parsed.error, 400)
    }

   const result = await importBookmarks(locals.userId, parsed.result.rows, {
      duplicates: declaredDuplicates,
   })

   return new Response(JSON.stringify({ data: result }), {
      status: 200,
      headers: {
         "content-type": "application/json",
      },
   })
}
