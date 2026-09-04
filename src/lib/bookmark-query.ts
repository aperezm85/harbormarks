// Story 8 — the pure, unit-tested parser for bookmark search queries.
//
// This module has no database and no React dependencies. It turns the raw
// `q` string the dashboard sends into a structured object: recognized
// operators (`tag:`, `site:`, `is:`, `has:`, `before:`, `after:`) plus the
// remaining free text. `listBookmarks` in `bookmarks.ts` builds its SQL from
// that object with parameter binding — a parsed value is never interpolated
// into SQL text.
//
// The design mirrors how `websearch_to_tsquery` behaves: anything that is not
// a recognized operator degrades to a literal free-text term rather than an
// error, so a query can never crash the search.

export type BookmarkQueryOperator =
  | { kind: "tag"; value: string; token: string }
  | { kind: "site"; value: string; token: string }
  | { kind: "is"; value: "favorite" | "unread"; token: string }
  | { kind: "has"; value: "image"; token: string }
  | { kind: "before"; value: Date; token: string }
  | { kind: "after"; value: Date; token: string }

export type ParsedBookmarkQuery = {
  freeText: string
  operators: BookmarkQueryOperator[]
}

// Operator names are matched case-insensitively, but the token keeps the text
// exactly as the user typed it so the UI can display and remove chips.
const OPERATOR_NAMES = new Set([
  "tag",
  "site",
  "is",
  "has",
  "before",
  "after",
])

// Splits a query into tokens on whitespace, keeping double-quoted spans
// together so `tag:"machine learning"` is a single token. The quote characters
// are preserved in the token; unquoting happens when the value is read.
function tokenize(query: string): string[] {
  const tokens: string[] = []
  let current = ""
  let inQuotes = false

  for (const char of query) {
    if (char === '"') {
      inQuotes = !inQuotes
      current += char
    } else if (/\s/.test(char) && !inQuotes) {
      if (current.length > 0) {
        tokens.push(current)
        current = ""
      }
    } else {
      current += char
    }
  }

  if (current.length > 0) {
    tokens.push(current)
  }

  return tokens
}

// Strips one pair of surrounding double quotes, then trims. A lone quote or an
// unbalanced quote is left in place: only a value that both starts and ends
// with a quote is unquoted.
function unquote(value: string): string {
  let result = value

  if (result.length >= 2 && result.startsWith('"') && result.endsWith('"')) {
    result = result.slice(1, -1)
  }

  return result.trim()
}

// Parses a strict `YYYY-MM-DD` calendar date at midnight UTC. A bare
// `Date.parse` is not enough: it rolls `2026-02-30` over to March 2 instead of
// failing, so the components are verified to round-trip. Returns null for any
// malformed or impossible date.
function parseStrictDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return date
}

export function parseBookmarkQuery(query: string): ParsedBookmarkQuery {
  const operators: BookmarkQueryOperator[] = []
  const freeTextTokens: string[] = []

  for (const token of tokenize(query)) {
    const colonIndex = token.indexOf(":")

    if (colonIndex === -1) {
      freeTextTokens.push(token)
      continue
    }

    const operatorName = token.slice(0, colonIndex).toLowerCase()
    const value = unquote(token.slice(colonIndex + 1))

    if (!OPERATOR_NAMES.has(operatorName)) {
      // An unknown operator (`foo:bar`) is a literal text term, not an error.
      freeTextTokens.push(token)
      continue
    }

    switch (operatorName) {
      case "tag": {
        // An operator with an empty value is meaningless; the whole token
        // becomes free text instead.
        if (value === "") {
          freeTextTokens.push(token)
        } else {
          operators.push({ kind: "tag", value, token })
        }
        break
      }
      case "site": {
        if (value === "") {
          freeTextTokens.push(token)
        } else {
          operators.push({ kind: "site", value, token })
        }
        break
      }
      case "is": {
        // Only `favorite` and `unread` are valid; any other value degrades to
        // free text. `unread` is accepted now and ignored in the SQL until
        // story 12 adds the status column. The keyword is matched
        // case-insensitively, like `tag:` and `site:`.
        const isValue = value.toLowerCase()

        if (isValue === "favorite") {
          operators.push({ kind: "is", value: "favorite", token })
        } else if (isValue === "unread") {
          operators.push({ kind: "is", value: "unread", token })
        } else {
          freeTextTokens.push(token)
        }
        break
      }
      case "has": {
        if (value.toLowerCase() === "image") {
          operators.push({ kind: "has", value: "image", token })
        } else {
          freeTextTokens.push(token)
        }
        break
      }
      case "before": {
        // A malformed date is ignored entirely: it is neither an operator nor
        // free text, so the rest of the query still applies.
        const date = parseStrictDate(value)

        if (date !== null) {
          operators.push({ kind: "before", value: date, token })
        }
        break
      }
      case "after": {
        const date = parseStrictDate(value)

        if (date !== null) {
          operators.push({ kind: "after", value: date, token })
        }
        break
      }
    }
  }

  return {
    freeText: freeTextTokens.join(" ").trim(),
    operators,
  }
}

// Removes exactly one occurrence of `token` from the query, rejoining the
// remaining tokens with a single space. If the token is not present the query
// is returned unchanged. Used by the removable chips in the dashboard.
export function removeOperatorFromQuery(query: string, token: string): string {
  const tokens = tokenize(query)
  const index = tokens.indexOf(token)

  if (index === -1) {
    return query
  }

  tokens.splice(index, 1)
  return tokens.join(" ").trim()
}
