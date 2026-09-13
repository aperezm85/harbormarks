import { describe, expect, it } from "vitest"

import {
  DIGEST_SCOPE_LABELS,
  DIGEST_SCOPES,
  isDigestScope,
  toDigestArticles,
  type DigestBookmark,
} from "./digest-scope"

// Pure helpers only: anything touching Postgres lives behind
// ensureAuthSchema() and is covered by manual testing instead.

describe("isDigestScope", () => {
  it("accepts the three supported scopes", () => {
    expect(DIGEST_SCOPES).toHaveLength(3)
    for (const scope of ["unread_7d", "all_unread", "all_7d"]) {
      expect(isDigestScope(scope)).toBe(true)
    }
  })

  it("rejects anything else, including the empty string", () => {
    for (const value of ["", "weekly", "UNREAD_7D", null, undefined, 42]) {
      expect(isDigestScope(value)).toBe(false)
    }
  })

  it("labels every scope", () => {
    for (const scope of DIGEST_SCOPES) {
      expect(DIGEST_SCOPE_LABELS[scope].length).toBeGreaterThan(0)
    }
  })
})

describe("toDigestArticles", () => {
  it("falls back to the URL when the title is missing", () => {
    const rows: DigestBookmark[] = [
      {
        id: 1,
        url: "https://example.com/a",
        title: null,
        description: null,
        note: null,
        tags: null,
        createdAt: new Date("2026-09-01T10:00:00.000Z"),
      },
    ]
    const [article] = toDigestArticles(rows)
    expect(article.title).toBe("https://example.com/a")
    expect(article.description).toBeNull()
    expect(article.note).toBeNull()
    expect(article.tags).toEqual([])
    expect(article.savedAt).toBe("2026-09-01")
    expect(article.href).toBe("https://example.com/a")
  })

  it("drops blank tags and normalizes the saved date", () => {
    const rows: DigestBookmark[] = [
      {
        id: 2,
        url: "https://example.com/b",
        title: "  B  ",
        description: "  desc  ",
        note: "  read this  ",
        tags: ["rust", "  ", ""],
        createdAt: null,
      },
    ]
    const [article] = toDigestArticles(rows)
    expect(article.tags).toEqual(["rust"])
    expect(article.note).toBe("read this")
    expect(article.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
