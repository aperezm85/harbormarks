import type { APIRoute } from "astro"

import {
  createBookmarkExportStream,
  exportContentType,
  exportFilename,
  isBookmarkExportFormat,
} from "@/lib/bookmark-export"
import { streamBookmarksForExport } from "@/lib/bookmarks"

export const GET: APIRoute = async ({ request, locals }) => {
   if (!locals.userId) {
     return new Response(JSON.stringify({ error: "Unauthorized" }), {
       status: 401,
       headers: {
          "content-type": "application/json",
         },
       })
       }

   const url = new URL(request.url)
   const rawFormat = url.searchParams.get("format")

   if (!isBookmarkExportFormat(rawFormat)) {
     return new Response(
        JSON.stringify({
          error:
            "Invalid or missing format. Use format=json, format=csv, or format=html.",
            }),
           {
            status: 400,
             headers: {
                "content-type": "application/json",
                },
            }
             )
           }

   const includeTrashed = url.searchParams.get("includeTrashed") === "1"

   const rows = streamBookmarksForExport(locals.userId, { includeTrashed })
   const body = createBookmarkExportStream(rows, rawFormat)

   return new Response(body, {
     status: 200,
      headers: {
          "content-type": exportContentType(rawFormat),
          "content-disposition":
            `attachment; filename="${exportFilename(rawFormat)}"`,
           "cache-control": "no-store",
          },
       })
}
