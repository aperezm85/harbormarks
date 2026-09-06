import { describe, expect, it } from "vitest"

import { unwrapFreediumUrl } from "./freedium-url"

describe("unwrapFreediumUrl", () => {
  it("unwraps a freedium-mirror.cfd URL to the inner article URL", () => {
    const inner = unwrapFreediumUrl(
      "https://freedium-mirror.cfd/https://santoshyadav979439.medium.com/frontend-interview-roadmap-2026-land-your-offer-67d484aa40b1"
    )
    expect(inner?.href).toBe(
      "https://santoshyadav979439.medium.com/frontend-interview-roadmap-2026-land-your-offer-67d484aa40b1"
    )
  })

  it("unwraps http inner URLs and any freedium host", () => {
    const inner = unwrapFreediumUrl(
      "https://freedium.example.com/http://example.com/some-post"
    )
    expect(inner?.href).toBe("http://example.com/some-post")
  })

  it("unwraps percent-encoded inner URLs", () => {
    const encoded = encodeURIComponent("https://example.com/some-post")
    const inner = unwrapFreediumUrl(
      `https://freedium-mirror.cfd/${encoded}`
    )
    expect(inner?.href).toBe("https://example.com/some-post")
  })

  it("returns null for non-freedium hosts, even with an inner-looking path", () => {
    expect(
      unwrapFreediumUrl("https://example.com/https://other.com/post")
    ).toBeNull()
  })

  it("returns null for a freedium host with no inner URL", () => {
    expect(unwrapFreediumUrl("https://freedium-mirror.cfd/")).toBeNull()
    expect(unwrapFreediumUrl("https://freedium-mirror.cfd/some-slug")).toBeNull()
  })

  it("returns null for invalid input", () => {
    expect(unwrapFreediumUrl("not a url")).toBeNull()
  })
})
