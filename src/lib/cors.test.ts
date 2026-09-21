import { describe, expect, it } from "vitest"

import { buildCorsHeaders, getCorsOrigins } from "./cors"

const EXT = "chrome-extension://abcdefghijklmnopqrstuvwxyz123456"

function requestWithOrigin(origin: string | null) {
  const headers = new Headers()
  if (origin !== null) {
    headers.set("origin", origin)
  }
  return new Request("https://harbormarks.example.com/api/bookmarks", {
    headers,
  })
}

describe("getCorsOrigins", () => {
  it("splits, trims, and lowercases", () => {
    expect(getCorsOrigins({ HARBOR_CORS_ORIGINS: ` ${EXT} , HTTPS://Example.com ` })).toEqual([
      EXT,
      "https://example.com",
    ])
  })

  it("returns nothing when unset", () => {
    expect(getCorsOrigins({})).toEqual([])
  })
})

describe("buildCorsHeaders", () => {
  it("returns headers for an allow-listed origin", () => {
    const headers = buildCorsHeaders(requestWithOrigin(EXT), {
      HARBOR_CORS_ORIGINS: EXT,
    })
    expect(headers?.["Access-Control-Allow-Origin"]).toBe(EXT)
    expect(headers?.["Access-Control-Allow-Methods"]).toContain("POST")
    expect(headers?.["Access-Control-Allow-Headers"]).toContain("Authorization")
  })

  it("returns null without an Origin (curl, Shortcuts, SW)", () => {
    expect(
      buildCorsHeaders(requestWithOrigin(null), { HARBOR_CORS_ORIGINS: EXT })
    ).toBeNull()
  })

  it("fails closed for non-listed and malformed origins", () => {
    expect(
      buildCorsHeaders(requestWithOrigin("https://evil.example"), {
        HARBOR_CORS_ORIGINS: EXT,
      })
    ).toBeNull()
    expect(
      buildCorsHeaders(requestWithOrigin("not a url"), {
        HARBOR_CORS_ORIGINS: "not a url",
      })
    ).toBeNull()
    expect(buildCorsHeaders(requestWithOrigin(EXT), {})).toBeNull()
  })
})
