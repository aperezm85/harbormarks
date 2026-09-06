import type { APIRoute } from "astro"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { updateProfileAvatar } from "@/lib/auth"
import { getAvatarDir } from "@/lib/avatar-storage"

const MAX_FILE_BYTES = 512 * 1024
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const contentType = request.headers.get("content-type") ?? ""
  let avatarUrl: string | null

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      avatarUrl?: unknown
    } | null
    const raw = typeof body?.avatarUrl === "string" ? body.avatarUrl : ""
    avatarUrl = raw.trim() === "" ? null : raw.trim()
  } else {
    const form = await request.formData().catch(() => null)
    if (!form) {
      return Response.json({ error: "Invalid request" }, { status: 400 })
    }

    const urlField = form.get("avatarUrl")
    const fileField = form.get("file")

    if (fileField instanceof File && fileField.size > 0) {
      const ext = ALLOWED_TYPES[fileField.type]
      if (!ext) {
        return Response.json(
          { error: "Only PNG, JPEG, or WebP images are allowed" },
          { status: 400 }
        )
      }
      if (fileField.size > MAX_FILE_BYTES) {
        return Response.json(
          { error: "Image must be 512KB or smaller" },
          { status: 400 }
        )
      }

      // NOTE: sharp is not installed, so uploads are stored as-is without
      // resizing. Revisit if server-side 96-256px square resizing is needed.
      const buffer = Buffer.from(await fileField.arrayBuffer())
      const dir = getAvatarDir()
      await mkdir(dir, { recursive: true })
      const filename = `${locals.userId}-${Date.now()}.${ext}`
      await writeFile(join(dir, filename), buffer)
      // Served via src/pages/api/avatar/[file].ts (not the static public
      // middleware, which 404s on newly written files in `astro dev`).
      // Old `/uploads/avatars/*` URLs keep working via the compat route at
      // src/pages/uploads/avatars/[file].ts.
      avatarUrl = `/api/avatar/${filename}`
    } else if (typeof urlField === "string") {
      avatarUrl = urlField.trim() === "" ? null : urlField.trim()
    } else {
      return Response.json({ error: "No avatar provided" }, { status: 400 })
    }
  }

  const updated = await updateProfileAvatar(locals.userId, avatarUrl)

  if ("error" in updated && updated.error) {
    return Response.json({ error: updated.error }, { status: 400 })
  }

  return Response.json({ data: updated.data })
}
