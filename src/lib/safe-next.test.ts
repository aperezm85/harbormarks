import { describe, expect, it } from "vitest"

import { isSafeNextPath, resolveNextPath } from "./safe-next"

describe("isSafeNextPath", () => {
  it("accepts same-origin paths with queries", () => {
    expect(isSafeNextPath("/")).toBe(true)
    expect(isSafeNextPath("/save")).toBe(true)
    expect(
      isSafeNextPath("/save?url=https://example.com/a&title=Hello%20World")
    ).toBe(true)
    expect(isSafeNextPath("/tag?tag=rust")).toBe(true)
  })

  it("rejects protocol-relative, absolute, and backslash URLs", () => {
    expect(isSafeNextPath("//evil.com/")).toBe(false)
    expect(isSafeNextPath("/\\evil.com")).toBe(false)
    expect(isSafeNextPath("/\\")).toBe(false)
    expect(isSafeNextPath("https://evil.com/")).toBe(false)
    expect(isSafeNextPath("javascript:alert(1)")).toBe(false)
  })

  it("rejects encoded traversal and non-strings", () => {
    expect(isSafeNextPath("/%2Fevil.com")).toBe(false)
    expect(isSafeNextPath("")).toBe(false)
    expect(isSafeNextPath(null)).toBe(false)
    expect(isSafeNextPath(undefined)).toBe(false)
    expect(isSafeNextPath(42)).toBe(false)
  })
})

describe("resolveNextPath", () => {
  it("returns the trimmed target when safe", () => {
    expect(resolveNextPath(" /save?a=b ")).toBe("/save?a=b")
  })

  it("falls back when missing or unsafe", () => {
    expect(resolveNextPath(null)).toBe("/")
    expect(resolveNextPath("//evil.com")).toBe("/")
    expect(resolveNextPath("//evil.com", "/favorites")).toBe("/favorites")
  })
})
