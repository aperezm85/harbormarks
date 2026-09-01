import { describe, expect, it } from "vitest"

import { normalizeBookmarkUrl } from "./bookmark-url"

const cases: Array<{ name: string; input: string | null | undefined; expected: string | null }> = [
  { name: "bare host gets https and trailing slash", input: "example.com", expected: "https://example.com/" },
  { name: "mixed case and trailing slash", input: "HTTPS://Example.COM/Path/", expected: "https://example.com/Path" },
  { name: "strips leading www", input: "https://www.example.com", expected: "https://example.com/" },
  { name: "drops default https port", input: "https://example.com:443/a", expected: "https://example.com/a" },
  { name: "drops tracking params", input: "https://example.com/a?utm_source=x&b=2", expected: "https://example.com/a?b=2" },
  { name: "sorts remaining params", input: "https://example.com/a?b=2&a=1", expected: "https://example.com/a?a=1&b=2" },
  { name: "rejects javascript: scheme", input: "javascript:alert(1)", expected: null },
  { name: "rejects ftp scheme", input: "ftp://example.com", expected: null },
  { name: "rejects empty string", input: "", expected: null },
  { name: "rejects whitespace", input: "    ", expected: null },
  { name: "rejects null", input: null, expected: null },
  { name: "rejects undefined", input: undefined, expected: null },
]

describe("normalizeBookmarkUrl", () => {
  for (const { name, input, expected } of cases) {
    it(name, () => {
      expect(normalizeBookmarkUrl(input)).toBe(expected)
     })
   }
})
