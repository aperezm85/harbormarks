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
 * Primary avatar URL for new uploads (`/api/avatar/<file>`). Does not rely
 * on Astro's static public-dir serving, so it works in `astro dev`
 * immediately after upload without a restart.
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
