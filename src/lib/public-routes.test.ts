import { describe, expect, it } from "vitest"

import { isPublicRoute } from "./public-routes"

describe("isPublicRoute", () => {
  it("allows the configured public auth, health, and asset paths", () => {
    expect(isPublicRoute("/login")).toBe(true)
    expect(isPublicRoute("/register")).toBe(true)
    expect(isPublicRoute("/verify-email")).toBe(true)
    expect(isPublicRoute("/forgot-password")).toBe(true)
    expect(isPublicRoute("/reset-password")).toBe(true)
    expect(isPublicRoute("/api/auth/login")).toBe(true)
    expect(isPublicRoute("/api/auth/register")).toBe(true)
    expect(isPublicRoute("/api/healthz")).toBe(true)
    expect(isPublicRoute("/healthz")).toBe(true)
    expect(isPublicRoute("/api/digest/run")).toBe(true)
    expect(isPublicRoute("/api/bookmarks/42/open")).toBe(true)
    expect(isPublicRoute("/assets/logo.svg")).toBe(true)
    expect(isPublicRoute("/favicon.ico")).toBe(true)
    expect(isPublicRoute("/_astro/entry.js")).toBe(true)
  })

  it("blocks authenticated app pages and API routes", () => {
    expect(isPublicRoute("/dashboard")).toBe(false)
    expect(isPublicRoute("/tags")).toBe(false)
    expect(isPublicRoute("/api/bookmarks")).toBe(false)
    expect(isPublicRoute("/api/admin/users")).toBe(false)
    expect(isPublicRoute("/admin")).toBe(false)
  })

  it("does not treat similar paths as public", () => {
    expect(isPublicRoute("/api/bookmarks/42/open/extra")).toBe(false)
    expect(isPublicRoute("/api/auth")).toBe(false)
    expect(isPublicRoute("/assets")).toBe(true)
  })
})
