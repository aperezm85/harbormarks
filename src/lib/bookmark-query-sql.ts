// Turns the operators parsed by `bookmark-query.ts` into SQL conditions.
//
// This stays separate from `bookmarks.ts` (and free of any database
// connection) so the generated SQL can be unit-tested directly.
//
// Combination rules, which the UI and docs rely on:
//   - different operator kinds AND together;
//   - repeated `tag:` AND (a bookmark must carry every tag);
//   - repeated `site:` OR (a bookmark may come from any listed site);
//   - repeated status filters (`is:unread is:reading`) OR, since a bookmark has
//     exactly one status; `is:favorite` / `is:broken` AND with them;
//   - `before:` / `after:` AND, forming a date range;
//   - a `-` prefix excludes, and every exclusion ANDs.
//
// Every condition returned is self-contained and parenthesised where it uses
// `or`, because the caller joins them with `and(...)` next to the user-scoping
// and soft-delete filters. An unparenthesised `or` here would split the whole
// WHERE clause and bypass that scoping.

import { eq, sql, type SQL } from "drizzle-orm"

import { bookmarks } from "@/db/schema"
import type { BookmarkQueryOperator } from "@/lib/bookmark-query"

type StatusValue = "unread" | "reading" | "archived"

const STATUS_VALUES: readonly string[] = ["unread", "reading", "archived"]

function hostMatches(site: string): SQL {
  // The host is extracted from the stored URL. Matching is exact-host OR
  // subdomain; the `%.` prefix keeps `notgithub.com` and `github.com.evil.com`
  // from matching `site:github.com`.
  const host = sql`lower(coalesce(
    (regexp_match(${bookmarks.url}, '^[a-z][a-z0-9+.-]*://([^/:?#]+)'))[1],
    ''
  ))`

  return sql`(${host} = ${site} or ${host} like ${`%.${site}`})`
}

function hasImage(): SQL {
  // A blank string is not an image: the card falls back to its gradient.
  return sql`(${bookmarks.previewImage} is not null and btrim(${bookmarks.previewImage}) <> '')`
}

export function buildOperatorFilters(
  operators: BookmarkQueryOperator[]
): SQL[] {
  const filters: SQL[] = []
  const includeSites: string[] = []
  const includeStatuses: StatusValue[] = []

  for (const op of operators) {
    switch (op.kind) {
      case "tag": {
        const exists = sql`exists (
          select 1
          from unnest(coalesce(${bookmarks.tags}, ARRAY[]::text[])) as bookmark_tag
          where lower(bookmark_tag) = ${op.value.toLowerCase()}
        )`
        filters.push(op.negated ? sql`not ${exists}` : exists)
        break
      }
      case "site": {
        if (op.negated) {
          filters.push(sql`not ${hostMatches(op.value)}`)
        } else {
          includeSites.push(op.value)
        }
        break
      }
      case "is": {
        if (STATUS_VALUES.includes(op.value)) {
          if (op.negated) {
            filters.push(
              sql`${bookmarks.status} is distinct from ${op.value}`
            )
          } else {
            includeStatuses.push(op.value as StatusValue)
          }
        } else if (op.value === "favorite") {
          filters.push(
            op.negated
              ? sql`${bookmarks.isFavorite} = false`
              : eq(bookmarks.isFavorite, true)
          )
        } else if (op.value === "broken") {
          filters.push(
            op.negated
              ? sql`${bookmarks.linkHealth} is distinct from 'broken'`
              : eq(bookmarks.linkHealth, "broken")
          )
        }
        break
      }
      case "has": {
        filters.push(op.negated ? sql`not ${hasImage()}` : hasImage())
        break
      }
      case "before": {
        // `created_at` is `timestamp without time zone` and the session
        // timezone is UTC, so binding the JS Date (midnight UTC) matches how
        // rows are written.
        filters.push(sql`${bookmarks.createdAt} < ${op.value}`)
        break
      }
      case "after": {
        filters.push(sql`${bookmarks.createdAt} >= ${op.value}`)
        break
      }
    }
  }

  if (includeSites.length > 0) {
    filters.push(
      sql`(${sql.join(
        includeSites.map((site) => hostMatches(site)),
        sql` or `
      )})`
    )
  }

  if (includeStatuses.length > 0) {
    filters.push(
      sql`${bookmarks.status} in (${sql.join(
        [...new Set(includeStatuses)].map((status) => sql`${status}`),
        sql`, `
      )})`
    )
  }

  return filters
}
