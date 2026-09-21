import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

export const API_KEY_PREFIX = "hm_"
const API_KEY_RANDOM_BYTES = 32
const MAX_KEY_NAME_LENGTH = 64

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

export function generateApiKey(): { key: string; hash: string } {
  const key = `${API_KEY_PREFIX}${randomBytes(API_KEY_RANDOM_BYTES).toString("hex")}`
  return { key, hash: sha256Hex(key) }
}

export function hashApiKey(key: string): string {
  return sha256Hex(key)
}

export function verifyApiKey(candidate: string, expectedHash: string): boolean {
  try {
    const a = Buffer.from(sha256Hex(candidate), "hex")
    const b = Buffer.from(expectedHash, "hex")
    if (a.length !== b.length) {
      return false
    }
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function validateKeyName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_KEY_NAME_LENGTH) {
    return null
  }
  return trimmed
}

export function parseBearerToken(header: string | null | undefined): string | null {
  if (!header) {
    return null
  }
  const match = header.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  return token ? token : null
}
