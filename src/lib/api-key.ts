import { createHash } from "node:crypto"
import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/db/client"
import { apiKeys, users } from "@/db/schema"
import {
  API_KEY_PREFIX,
  generateApiKey,
} from "@/lib/api-key-utils"
import { ensureAuthSchema, type AuthenticatedUser } from "@/lib/auth"

export {
  API_KEY_PREFIX,
  generateApiKey,
  hashApiKey,
  parseBearerToken,
  validateKeyName,
  verifyApiKey,
} from "@/lib/api-key-utils"

export type ApiKeySummary = {
  id: number
  name: string
  lastUsedAt: string | null
  createdAt: string
}

export type CreatedApiKey = {
  id: number
  name: string
  key: string
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function md5(value: string) {
  return createHash("md5").update(value).digest("hex")
}

function gravatarFallback(email: string) {
  const normalized = email.trim().toLowerCase()
  const [localPart] = normalized.split("@")
  const hash = md5(normalized)
  const background = `#${hash.slice(0, 6)}`
  const glyph = (localPart?.trim().slice(0, 1) || "U").toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" role="img" aria-label="avatar"><rect width="96" height="96" rx="24" fill="${background}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Inter,system-ui,sans-serif" font-size="44" font-weight="700">${glyph}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function toSummary(row: {
  id: number
  name: string
  lastUsedAt: Date | null
  createdAt: Date | null
}): ApiKeySummary {
  return {
    id: row.id,
    name: row.name,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
  }
}

export async function createApiKey(
  userId: number,
  name: string
): Promise<CreatedApiKey> {
  await ensureAuthSchema()
  const { key, hash } = generateApiKey()
  const [row] = await db
    .insert(apiKeys)
    .values({ userId, name, keyHash: hash })
    .returning({ id: apiKeys.id, name: apiKeys.name })
  return { id: row.id, name: row.name, key }
}

export async function listApiKeysByUser(userId: number): Promise<ApiKeySummary[]> {
  await ensureAuthSchema()
  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .orderBy(apiKeys.id)
  return rows.map(toSummary)
}

export async function revokeApiKey(userId: number, id: number): Promise<boolean> {
  await ensureAuthSchema()
  if (!Number.isInteger(id) || id <= 0) {
    return false
  }
  const [updated] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id })
  return Boolean(updated)
}

export async function getApiKeyUser(
  rawKey: string | null | undefined
): Promise<AuthenticatedUser | null> {
  await ensureAuthSchema()
  if (!rawKey) {
    return null
  }
  const token = rawKey.trim()
  if (!token.startsWith(API_KEY_PREFIX)) {
    return null
  }
  const keyHash = sha256Hex(token)
  const [row] = await db
    .select({
      keyId: apiKeys.id,
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      isActive: users.isActive,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1)

  if (!row || !row.isActive) {
    return null
  }

  // Best-effort usage tracking; a write failure must never fail auth.
  void db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.keyId))
    .catch((error: unknown) => {
      console.error("[api-key] last_used_at update failed", error)
    })

  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl ?? gravatarFallback(row.email),
    role: row.role === "admin" ? "admin" : "user",
    isActive: row.isActive,
    emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
  }
}
