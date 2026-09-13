import type { DigestArticle } from "@/lib/email-templates"

// Pure digest helpers: no database, no network, safe to unit-test anywhere.
// The Postgres-backed queries live in src/lib/digest.ts and re-export these.

export const DIGEST_SCOPES = ["unread_7d", "all_unread", "all_7d"] as const
export type DigestScope = (typeof DIGEST_SCOPES)[number]

export const DIGEST_SCOPE_LABELS: Record<DigestScope, string> = {
  unread_7d: "unread links from the last 7 days",
  all_unread: "all unread links",
  all_7d: "all links from the last 7 days",
}

export function isDigestScope(value: unknown): value is DigestScope {
  return (
    typeof value === "string" &&
    (DIGEST_SCOPES as readonly string[]).includes(value)
  )
}

export function normalizeDigestScope(value: unknown): DigestScope {
  return isDigestScope(value) ? value : "unread_7d"
}

export type DigestBookmark = {
  id: number
  url: string
  title: string | null
  description: string | null
  note: string | null
  tags: string[] | null
  createdAt: Date | null
}

export function toDigestArticles(rows: DigestBookmark[]): DigestArticle[] {
  return rows.map((row) => ({
    title: row.title?.trim() || row.url,
    url: row.url,
    // Default href is the direct URL; sendDigestForUser() replaces it with a
    // signed tracking link. Kept separate so previews/tests render without a
    // database secret.
    href: row.url,
    description: row.description?.trim() || null,
    note: row.note?.trim() || null,
    tags: (row.tags ?? []).filter((tag) => tag.trim() !== ""),
    savedAt: row.createdAt
      ? row.createdAt.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  }))
}
