import { describe, expect, it } from "vitest"

describe("classifyLinkHealthResponse", () => {
  it("treats redirects as healthy and rejects broken HTTP failures", async () => {
    const { classifyLinkHealthResponse } = await import("./link-health-check")

    expect(classifyLinkHealthResponse(200)).toBe(true)
    expect(classifyLinkHealthResponse(301)).toBe(true)
    expect(classifyLinkHealthResponse(302)).toBe(true)
    expect(classifyLinkHealthResponse(404)).toBe(false)
    expect(classifyLinkHealthResponse(500)).toBe(false)
  })
})

describe("syncBrokenTagState", () => {
  it("keeps a single broken tag and removes it when the page is healthy", async () => {
    const { syncBrokenTagState } = await import("./link-health-check")

    expect(syncBrokenTagState(["broken", "dev", "broken"], false)).toEqual([
      "dev",
      "broken",
    ])
    expect(syncBrokenTagState(["dev", "broken", "broken"], true)).toEqual([
      "dev",
    ])
  })
})
