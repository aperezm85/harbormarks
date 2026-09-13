import { createHmac, timingSafeEqual } from "node:crypto"

// Pure email-link signature primitives: no database, no stored secret, safe to
// unit-test anywhere. The secret lifecycle (generate once, persist in
// app_settings) lives in src/lib/link-tokens.ts and re-exports these.

function signaturePayload(userId: number, bookmarkId: number): string {
  return `${userId}:${bookmarkId}`
}

export function signWithSecret(
  secret: Buffer,
  userId: number,
  bookmarkId: number
): string {
  return createHmac("sha256", secret)
    .update(signaturePayload(userId, bookmarkId))
    .digest("base64url")
}

export function verifyWithSecret(
  secret: Buffer,
  userId: number,
  bookmarkId: number,
  signature: string
): boolean {
  if (!signature) {
    return false
  }
  const expected = signWithSecret(secret, userId, bookmarkId)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
