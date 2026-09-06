import { join } from "node:path"

/**
 * Single source of truth for avatar file storage.
 *
 * Uploads are written to `<root>/public/uploads/avatars/` (see
 * `src/pages/api/auth/profile-avatar.ts`). In `astro dev` newly written
 * files under `public/` are not reliably served until restart, so avatars
 * are streamed through dedicated GET routes instead of relying on the
 * static public middleware:
 * - Primary (new uploads): `/api/avatar/[file]`
 * - Backward compat (URLs already stored in DB): `/uploads/avatars/[file]`
 *
 * Both routes read from the same directory, so write dir == serve dir.
 */
export function getAvatarDir() {
  return join(process.cwd(), "public", "uploads", "avatars")
}

const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(png|jpg|jpeg|webp)$/i

export function isSafeAvatarFilename(candidate: string | undefined) {
  if (!candidate) {
    return false
  }
  if (candidate.includes("/") || candidate.includes("\\")) {
    return false
  }
  if (candidate.includes("..")) {
    return false
  }
  return SAFE_FILENAME.test(candidate)
}

export function avatarContentType(filename: string) {
  const lowered = filename.toLowerCase()
  if (lowered.endsWith(".png")) {
    return "image/png"
  }
  if (lowered.endsWith(".webp")) {
    return "image/webp"
  }
  return "image/jpeg"
}

/** Avatars are immutable per filename (`<userId>-<timestamp>.<ext>`). */
export function avatarCacheHeaders() {
  return {
    "Cache-Control": "public, max-age=31536000, immutable",
  }
}
