import { describe, expect, it } from "vitest"

import {
  parseBookmarkQuery,
  removeOperatorFromQuery,
  type BookmarkQueryOperator,
} from "./bookmark-query"

// These tests are pure: they exercise the parser with no database, so they run
// regardless of whether TEST_DATABASE_URL is set.

const MIDNIGHT = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

type ParseCase = {
  name: string
  query: string
  freeText: string
  operators: BookmarkQueryOperator[]
}

const parseCases: ParseCase[] = [
  {
    name: "tag operator alone",
    query: "tag:rust",
    freeText: "",
    operators: [{ kind: "tag", value: "rust", token: "tag:rust" }],
  },
  {
    name: "site operator alone",
    query: "site:github.com",
    freeText: "",
    operators: [{ kind: "site", value: "github.com", token: "site:github.com" }],
  },
  {
    name: "is:favorite alone",
    query: "is:favorite",
    freeText: "",
    operators: [{ kind: "is", value: "favorite", token: "is:favorite" }],
  },
  {
    name: "is:unread is accepted and recorded",
    query: "is:unread",
    freeText: "",
    operators: [{ kind: "is", value: "unread", token: "is:unread" }],
  },
  {
    name: "is:reading is accepted and recorded",
    query: "is:reading",
    freeText: "",
    operators: [{ kind: "is", value: "reading", token: "is:reading" }],
  },
  {
    name: "is:archived is accepted and recorded",
    query: "is:archived",
    freeText: "",
    operators: [{ kind: "is", value: "archived", token: "is:archived" }],
  },
  {
    name: "has:image alone",
    query: "has:image",
    freeText: "",
    operators: [{ kind: "has", value: "image", token: "has:image" }],
  },
  {
    name: "before operator parses a strict date at midnight UTC",
    query: "before:2026-01-01",
    freeText: "",
    operators: [
      { kind: "before", value: MIDNIGHT("2026-01-01"), token: "before:2026-01-01" },
    ],
  },
  {
    name: "after operator parses a strict date at midnight UTC",
    query: "after:2026-01-01",
    freeText: "",
    operators: [
      { kind: "after", value: MIDNIGHT("2026-01-01"), token: "after:2026-01-01" },
    ],
  },
  {
    name: "quoted multi-word tag keeps one token and strips the quotes",
    query: 'tag:"machine learning"',
    freeText: "",
    operators: [
      { kind: "tag", value: "machine learning", token: 'tag:"machine learning"' },
    ],
  },
  {
    name: "two operators combine with no free text",
    query: "tag:rust site:github.com",
    freeText: "",
    operators: [
      { kind: "tag", value: "rust", token: "tag:rust" },
      { kind: "site", value: "github.com", token: "site:github.com" },
    ],
  },
  {
    name: "a repeated operator records both occurrences",
    query: "tag:a tag:b",
    freeText: "",
    operators: [
      { kind: "tag", value: "a", token: "tag:a" },
      { kind: "tag", value: "b", token: "tag:b" },
    ],
  },
  {
    name: "an operator and free text mix",
    query: "tag:rust rust",
    freeText: "rust",
    operators: [{ kind: "tag", value: "rust", token: "tag:rust" }],
  },
  {
    name: "an unknown operator degrades to free text",
    query: "foo:bar",
    freeText: "foo:bar",
    operators: [],
  },
  {
    name: "is:favorite with trailing free text",
    query: "is:favorite rust",
    freeText: "rust",
    operators: [{ kind: "is", value: "favorite", token: "is:favorite" }],
  },
  {
    name: "a malformed date is ignored, the rest still applies",
    query: "before:not-a-date rust",
    freeText: "rust",
    operators: [],
  },
  {
    name: "an impossible calendar date is ignored (Date.parse rollover trap)",
    query: "before:2026-02-30 rust",
    freeText: "rust",
    operators: [],
  },
  {
    name: "a valid date with trailing free text",
    query: "after:2026-01-01 guide",
    freeText: "guide",
    operators: [
      { kind: "after", value: MIDNIGHT("2026-01-01"), token: "after:2026-01-01" },
    ],
  },
  {
    name: "an empty query has no operators and no free text",
    query: "",
    freeText: "",
    operators: [],
  },
  {
    name: "a whitespace-only query has no operators and no free text",
    query: "   ",
    freeText: "",
    operators: [],
  },
  {
    name: "a known operator with an empty value becomes free text",
    query: "tag: rust",
    freeText: "tag: rust",
    operators: [],
  },
  {
    name: "an is value outside the whitelist becomes free text",
    query: "is:later rust",
    freeText: "is:later rust",
    operators: [],
  },
  {
    name: "a has value outside the whitelist becomes free text",
    query: "has:video rust",
    freeText: "has:video rust",
    operators: [],
  },
  {
    name: "operator names are matched case-insensitively",
    query: "TAG:rust",
    freeText: "",
    operators: [{ kind: "tag", value: "rust", token: "TAG:rust" }],
  },
  {
    name: "is keyword values are matched case-insensitively",
    query: "is:Favorite",
    freeText: "",
    operators: [{ kind: "is", value: "favorite", token: "is:Favorite" }],
  },
  {
    name: "has keyword values are matched case-insensitively",
    query: "has:Image",
    freeText: "",
    operators: [{ kind: "has", value: "image", token: "has:Image" }],
  },
]

describe("parseBookmarkQuery", () => {
  for (const { name, query, freeText, operators } of parseCases) {
    it(name, () => {
      expect(parseBookmarkQuery(query)).toEqual({ freeText, operators })
    })
  }
})

describe("removeOperatorFromQuery", () => {
  it("removes a single-token operator and keeps the free text", () => {
    expect(removeOperatorFromQuery("tag:rust rust", "tag:rust")).toBe("rust")
  })

  it("removes a quoted multi-word operator and keeps the free text", () => {
    expect(
      removeOperatorFromQuery('tag:"machine learning" rust', 'tag:"machine learning"')
    ).toBe("rust")
  })

  it("returns the query unchanged when the token is not present", () => {
    expect(removeOperatorFromQuery("tag:rust rust", "site:github.com")).toBe(
      "tag:rust rust"
    )
  })

  it("removes exactly one of two identical tokens", () => {
    expect(removeOperatorFromQuery("tag:a tag:a", "tag:a")).toBe("tag:a")
  })

  it("trims the result after removal", () => {
    expect(removeOperatorFromQuery("tag:rust", "tag:rust")).toBe("")
  })
})
