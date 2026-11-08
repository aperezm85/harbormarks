import { PgDialect } from "drizzle-orm/pg-core"
import { and, eq, sql } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { bookmarks } from "@/db/schema"
import { parseBookmarkQuery } from "./bookmark-query"
import { buildOperatorFilters } from "./bookmark-query-sql"

// Pure SQL-shape tests: no database. They guard the property that broke in
// v1.6.0 — every condition is joined with `and` next to the user-scoping
// filter, so a bare top-level `or` would bypass it.

const dialect = new PgDialect()

function render(query: string) {
  const filters = buildOperatorFilters(parseBookmarkQuery(query).operators)
  return dialect.sqlToQuery(
    and(eq(bookmarks.userId, 7), sql`1 = 1`, ...filters)!
  )
}

// Drops everything inside balanced parentheses, so any `or` left over sits at
// the top level of the WHERE clause.
function topLevelOnly(text: string) {
  let depth = 0
  let out = ""

  for (const char of text) {
    if (char === "(") depth += 1
    else if (char === ")") depth -= 1
    else if (depth === 0) out += char
  }

  return out
}

const queries = [
  "site:example.com",
  "site:a.com site:b.com",
  "-site:example.com",
  "site:a.com -site:b.com tag:x is:unread",
  "is:unread is:reading",
  "is:unread is:favorite -is:broken",
  "has:image",
  "-has:image",
  "tag:a tag:b -tag:c",
  "before:2026-01-01 after:2025-01-01",
]

describe("buildOperatorFilters", () => {
  it.each(queries)("never leaves a top-level OR: %s", (query) => {
    const { sql: text } = render(query)

    expect(topLevelOnly(text)).not.toMatch(/\bor\b/i)
  })

  it.each(queries)("keeps the user scoping condition in the AND chain: %s", (query) => {
    const { sql: text, params } = render(query)

    expect(text).toContain(`"bookmarks"."user_id" = $1`)
    expect(params[0]).toBe(7)
  })

  it("binds values as parameters, never as SQL text", () => {
    const { sql: text, params } = render(`tag:"x'; drop table bookmarks;--"`)

    expect(text).not.toContain("drop table")
    expect(params.join(" ")).toContain("drop table bookmarks")
  })

  it("ORs repeated sites and statuses inside one parenthesised condition", () => {
    const sites = render("site:a.com site:b.com").sql
    const statuses = render("is:unread is:reading").sql

    expect(sites.match(/like/g)).toHaveLength(2)
    expect(statuses).toContain(`"bookmarks"."status" in (`)
  })
})
