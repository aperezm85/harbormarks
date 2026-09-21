import { describe, expect, it } from "vitest"

import {
  API_KEY_PREFIX,
  generateApiKey,
  hashApiKey,
  parseBearerToken,
  validateKeyName,
  verifyApiKey,
} from "./api-key-utils"

describe("generateApiKey", () => {
  it("returns a prefixed key with a matching sha256 hash", () => {
    const { key, hash } = generateApiKey()
    expect(key.startsWith(API_KEY_PREFIX)).toBe(true)
    expect(hash).toBe(hashApiKey(key))
    expect(verifyApiKey(key, hash)).toBe(true)
  })

  it("generates unique keys", () => {
    expect(generateApiKey().key).not.toBe(generateApiKey().key)
  })
})

describe("verifyApiKey", () => {
  it("rejects the wrong key and malformed hashes", () => {
    const { key, hash } = generateApiKey()
    expect(verifyApiKey(`${key}x`, hash)).toBe(false)
    expect(verifyApiKey(key, "not-hex")).toBe(false)
    expect(verifyApiKey(key, hashApiKey("other"))).toBe(false)
  })
})

describe("validateKeyName", () => {
  it("trims and accepts normal names", () => {
    expect(validateKeyName("  iPhone Shortcut ")).toBe("iPhone Shortcut")
  })

  it("rejects empty, blank, over-long, and non-string names", () => {
    expect(validateKeyName("")).toBeNull()
    expect(validateKeyName("   ")).toBeNull()
    expect(validateKeyName("x".repeat(65))).toBeNull()
    expect(validateKeyName(null)).toBeNull()
    expect(validateKeyName(42)).toBeNull()
  })
})

describe("parseBearerToken", () => {
  it("extracts the token case-insensitively", () => {
    expect(parseBearerToken("Bearer abc123")).toBe("abc123")
    expect(parseBearerToken("bearer abc123")).toBe("abc123")
    expect(parseBearerToken("Bearer   abc123  ")).toBe("abc123")
  })

  it("returns null for missing, empty, or non-bearer schemes", () => {
    expect(parseBearerToken(null)).toBeNull()
    expect(parseBearerToken(undefined)).toBeNull()
    expect(parseBearerToken("")).toBeNull()
    expect(parseBearerToken("Bearer ")).toBeNull()
    expect(parseBearerToken("Basic abc123")).toBeNull()
  })
})
