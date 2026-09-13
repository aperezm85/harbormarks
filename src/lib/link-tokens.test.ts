import { randomBytes } from "node:crypto"

import { describe, expect, it } from "vitest"

import { signWithSecret, verifyWithSecret } from "./link-signature"

// Pure HMAC helpers only: no database, no stored secret needed.

describe("email link signatures", () => {
  it("round-trips for the owning user and bookmark", () => {
    const secret = randomBytes(32)
    const sig = signWithSecret(secret, 7, 42)
    expect(verifyWithSecret(secret, 7, 42, sig)).toBe(true)
  })

  it("rejects a tampered signature", () => {
    const secret = randomBytes(32)
    const sig = signWithSecret(secret, 7, 42)
    const tampered = `${sig.slice(0, -1)}${sig.endsWith("A") ? "B" : "A"}`
    expect(verifyWithSecret(secret, 7, 42, tampered)).toBe(false)
  })

  it("rejects another bookmark id or another user", () => {
    const secret = randomBytes(32)
    const sig = signWithSecret(secret, 7, 42)
    expect(verifyWithSecret(secret, 7, 43, sig)).toBe(false)
    expect(verifyWithSecret(secret, 8, 42, sig)).toBe(false)
  })

  it("rejects another secret and empty input", () => {
    const secret = randomBytes(32)
    const sig = signWithSecret(secret, 7, 42)
    expect(verifyWithSecret(randomBytes(32), 7, 42, sig)).toBe(false)
    expect(verifyWithSecret(secret, 7, 42, "")).toBe(false)
  })
})
