import { describe, expect, it } from "vitest"

import {
  indexPath,
  MAX_QUERY_LENGTH,
  parseIndexView,
  readQueryParam,
  writeQueryParam,
} from "./search-params"

describe("readQueryParam", () => {
  it("reads and trims q", () => {
    expect(readQueryParam(new URLSearchParams("q=%20tag%3Arust%20"))).toBe(
      "tag:rust"
    )
  })

  it("returns an empty string when absent", () => {
    expect(readQueryParam(new URLSearchParams(""))).toBe("")
  })

  it("caps the length", () => {
    const long = "a".repeat(MAX_QUERY_LENGTH + 50)
    expect(readQueryParam(new URLSearchParams({ q: long }))).toHaveLength(
      MAX_QUERY_LENGTH
    )
  })
})

describe("writeQueryParam", () => {
  it("sets q and keeps other params", () => {
    const url = new URL("https://x.test/?view=unread")
    writeQueryParam(url, "site:github.com")
    expect(url.searchParams.get("q")).toBe("site:github.com")
    expect(url.searchParams.get("view")).toBe("unread")
  })

  it("removes q for an empty or blank query", () => {
    const url = new URL("https://x.test/?q=old")
    writeQueryParam(url, "   ")
    expect(url.search).toBe("")
  })

  it("round-trips special characters", () => {
    const url = new URL("https://x.test/")
    writeQueryParam(url, 'tag:"machine learning" -site:a.com &x=1')
    expect(readQueryParam(url.searchParams)).toBe(
      'tag:"machine learning" -site:a.com &x=1'
    )
  })
})

describe("parseIndexView", () => {
  it("accepts the index views and defaults to recent", () => {
    expect(parseIndexView("unread")).toBe("unread")
    expect(parseIndexView("mostVisited")).toBe("mostVisited")
    expect(parseIndexView("unorganized")).toBe("unorganized")
    expect(parseIndexView("trash")).toBe("recent")
    expect(parseIndexView("nope")).toBe("recent")
    expect(parseIndexView(null)).toBe("recent")
  })
})

describe("indexPath", () => {
  it("keeps the home URL clean", () => {
    expect(indexPath("recent", "")).toBe("/")
  })

  it("adds view and q only when needed", () => {
    expect(indexPath("unread", "")).toBe("/?view=unread")
    expect(indexPath("recent", "rust")).toBe("/?q=rust")
    expect(indexPath("unread", "is:broken")).toBe("/?view=unread&q=is%3Abroken")
  })
})
