import type { APIRoute } from "astro"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

import {
  avatarCacheHeaders,
  avatarContentType,
  getAvatarDir,
  isSafeAvatarFilename,
} from "@/lib/avatar-storage"

export const prerender = false

/**
 * Backward-compat shim: avatar URLs already stored in the DB look like
 * `/uploads/avatars/<file>`. In `astro dev` those files 404 when served
 * as static public assets after upload, so serve them from disk here.
 * New uploads return `/api/avatar/<file>` instead.
 */
export const GET: APIRoute = async ({ params }) => {
  const filename = params.file
  if (!isSafeAvatarFilename(filename)) {
    return new Response("Not found", { status: 404 })
  }

  let bytes: Buffer
  try {
    bytes = await readFile(join(getAvatarDir(), filename as string))
  } catch {
    return new Response("Not found", { status: 404 })
  }

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": avatarContentType(filename as string),
      ...avatarCacheHeaders(),
    },
  })
}
