import { describe, expect, it } from "vitest"

import { normalizeTags, parseTags } from "./bookmark-tags"

describe("parseTags", () => {
  it("parses a JSON array string", () => {
    expect(parseTags('["dev", "reading"]')).toEqual(["dev", "reading"])
    })

  it("parses a comma-separated string", () => {
    expect(parseTags("dev, reading")).toEqual(["dev", "reading"])
    })

  it("accepts an actual array and trims/empties entries", () => {
    expect(parseTags(["dev", " ", "reading"])).toEqual(["dev", "reading"])
    })

  it("returns empty for null, empty string, and whitespace", () => {
    expect(parseTags(null)).toEqual([])
    expect(parseTags("")).toEqual([])
    expect(parseTags("   ")).toEqual([])
    })

  it("falls back to comma parsing for malformed JSON", () => {
    expect(parseTags('["dev", "reading"')).toEqual(['["dev"', '"reading"'])
      })
})

describe("normalizeTags", () => {
  it("comma-splits a string", () => {
    expect(normalizeTags("dev, reading")).toEqual(["dev", "reading"])
      })

  it("accepts an actual array and trims/empties entries", () => {
    expect(normalizeTags(["dev", " ", "reading"])).toEqual(["dev", "reading"])
      })

  it("returns null for null, empty string, and whitespace-only", () => {
    expect(normalizeTags(null)).toBeNull()
    expect(normalizeTags("")).toBeNull()
    expect(normalizeTags("    ")).toBeNull()
    expect(normalizeTags([" ", ""])).toBeNull()
      })

  it("splits on every comma, quoting is not JSON-aware", () => {
    expect(normalizeTags('a,"b,c",d')).toEqual(["a", '"b', 'c"', "d"])
        })
})
