import { randomBytes } from "node:crypto"

import { eq, sql } from "drizzle-orm"

import { db } from "@/db/client"
import { appSettings } from "@/db/schema"
import { ensureAuthSchema } from "@/lib/auth"
import { signWithSecret, verifyWithSecret } from "@/lib/link-signature"

export { signWithSecret, verifyWithSecret } from "@/lib/link-signature"

// Signed email tracking links: /api/bookmarks/:id/open?sig=... These arrive
// logged out (often on another device), so the signature is the only proof the
// click belongs to the bookmark's owner. HMAC-SHA256 over "userId:bookmarkId"
// with a server secret that is generated once, stored in app_settings, and
// never leaves the database (migrations/0009_link_secret.sql).

const SECRET_SETTING_KEY = "email_link_secret"

async function ensureSettingsTable() {
  // migrate.mjs owns the schema in prod, but `pnpm dev` never runs it while
  // sharing the same database, so make first use self-sufficient. Mirrors the
  // migration file; IF NOT EXISTS keeps it a no-op everywhere else.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

export async function getLinkSecret(): Promise<Buffer> {
  await ensureAuthSchema()
  await ensureSettingsTable()

  const [existing] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, SECRET_SETTING_KEY))
    .limit(1)

  if (existing?.value) {
    return Buffer.from(existing.value, "hex")
  }

  // First digest ever sent: mint the secret. onConflictDoNothing covers two
  // processes racing here; re-read so both end up with the same value.
  const fresh = randomBytes(32).toString("hex")
  await db
    .insert(appSettings)
    .values({ key: SECRET_SETTING_KEY, value: fresh, updatedAt: new Date() })
    .onConflictDoNothing({ target: appSettings.key })

  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, SECRET_SETTING_KEY))
    .limit(1)

  if (!row?.value) {
    throw new Error("Could not initialize email link secret")
  }

  return Buffer.from(row.value, "hex")
}

export async function signBookmarkLink(
  userId: number,
  bookmarkId: number
): Promise<string> {
  return signWithSecret(await getLinkSecret(), userId, bookmarkId)
}

export async function verifyBookmarkLink(
  userId: number,
  bookmarkId: number,
  signature: string
): Promise<boolean> {
  if (!signature) {
    return false
  }
  return verifyWithSecret(await getLinkSecret(), userId, bookmarkId, signature)
}

export async function buildBookmarkOpenUrl(
  baseUrl: string,
  userId: number,
  bookmarkId: number
): Promise<string> {
  const sig = await signBookmarkLink(userId, bookmarkId)
  return `${baseUrl}/api/bookmarks/${bookmarkId}/open?sig=${encodeURIComponent(sig)}`
}
