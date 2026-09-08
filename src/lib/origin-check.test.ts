import { describe, expect, it } from "vitest"

import {
  createCrossOriginForbiddenResponse,
  getAllowedHostnames,
  isForbiddenCrossOriginRequest,
  isOriginCheckEnabled,
} from "./origin-check"

const PUBLIC_URL = new URL("https://harbormarks.example.com/api/auth/login")

// What the Node server actually sees behind a reverse proxy: the internal host
// it was forwarded to, not the public URL the browser used.
const PROXIED_URL = new URL("http://192.168.1.50:7878/api/auth/login")

function formPost(origin: string | null): Request {
  const headers = new Headers({
    "content-type": "application/x-www-form-urlencoded",
  })
  if (origin !== null) {
    headers.set("origin", origin)
  }
  return new Request("https://harbormarks.example.com/api/auth/login", {
    method: "POST",
    headers,
    body: "email=a%40b.com&password=secret",
  })
}

describe("isOriginCheckEnabled", () => {
  it("is on by default", () => {
    expect(isOriginCheckEnabled({})).toBe(true)
  })

  it("is off only for the exact string 'false'", () => {
    expect(isOriginCheckEnabled({ HARBOR_CHECK_ORIGIN: "false" })).toBe(false)
    expect(isOriginCheckEnabled({ HARBOR_CHECK_ORIGIN: "0" })).toBe(true)
    expect(isOriginCheckEnabled({ HARBOR_CHECK_ORIGIN: "true" })).toBe(true)
  })
})

describe("getAllowedHostnames", () => {
  it("splits, trims, lowercases and drops empties", () => {
    expect(
      getAllowedHostnames({
        HARBOR_ALLOWED_DOMAINS: " Harbormarks.Example.com , ,notes.example.com ",
      }),
    ).toEqual(["harbormarks.example.com", "notes.example.com"])
  })

  it("returns nothing when unset", () => {
    expect(getAllowedHostnames({})).toEqual([])
  })
})

describe("isForbiddenCrossOriginRequest", () => {
  it("allows safe methods regardless of origin", () => {
    const request = new Request(PUBLIC_URL, {
      method: "GET",
      headers: { origin: "https://evil.example" },
    })
    expect(isForbiddenCrossOriginRequest(request, PUBLIC_URL, false, {})).toBe(
      false,
    )
  })

  it("allows prerendered routes", () => {
    expect(
      isForbiddenCrossOriginRequest(
        formPost("https://evil.example"),
        PUBLIC_URL,
        true,
        {},
      ),
    ).toBe(false)
  })

  it("allows a same-origin form post", () => {
    expect(
      isForbiddenCrossOriginRequest(
        formPost("https://harbormarks.example.com"),
        PUBLIC_URL,
        false,
        {},
      ),
    ).toBe(false)
  })

  it("blocks a cross-origin form post", () => {
    expect(
      isForbiddenCrossOriginRequest(
        formPost("https://evil.example"),
        PUBLIC_URL,
        false,
        {},
      ),
    ).toBe(true)
  })

  it("blocks a form post with no Origin header", () => {
    expect(
      isForbiddenCrossOriginRequest(formPost(null), PUBLIC_URL, false, {}),
    ).toBe(true)
  })

  it("blocks a proxied request when the public hostname is not allowed", () => {
    expect(
      isForbiddenCrossOriginRequest(
        formPost("https://harbormarks.example.com"),
        PROXIED_URL,
        false,
        {},
      ),
    ).toBe(true)
  })

  it("allows a proxied request once its hostname is allowed", () => {
    expect(
      isForbiddenCrossOriginRequest(
        formPost("https://harbormarks.example.com"),
        PROXIED_URL,
        false,
        { HARBOR_ALLOWED_DOMAINS: "harbormarks.example.com" },
      ),
    ).toBe(false)
  })

  it("does not let the allowlist admit an unrelated origin", () => {
    expect(
      isForbiddenCrossOriginRequest(
        formPost("https://evil.example"),
        PROXIED_URL,
        false,
        { HARBOR_ALLOWED_DOMAINS: "harbormarks.example.com" },
      ),
    ).toBe(true)
  })

  it("does not trust a malformed Origin header", () => {
    expect(
      isForbiddenCrossOriginRequest(
        formPost("not a url"),
        PROXIED_URL,
        false,
        { HARBOR_ALLOWED_DOMAINS: "harbormarks.example.com" },
      ),
    ).toBe(true)
  })

  it("skips the check entirely when disabled", () => {
    expect(
      isForbiddenCrossOriginRequest(
        formPost("https://evil.example"),
        PUBLIC_URL,
        false,
        { HARBOR_CHECK_ORIGIN: "false" },
      ),
    ).toBe(false)
  })

  it("ignores non form-like content types, which browsers preflight", () => {
    const request = new Request(PUBLIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
      },
      body: "{}",
    })
    expect(isForbiddenCrossOriginRequest(request, PUBLIC_URL, false, {})).toBe(
      false,
    )
  })
})

describe("createCrossOriginForbiddenResponse", () => {
  it("returns 403 with the method in the message", async () => {
    const response = createCrossOriginForbiddenResponse(formPost(null))
    expect(response.status).toBe(403)
    await expect(response.text()).resolves.toBe(
      "Cross-site POST form submissions are forbidden",
    )
  })
})
