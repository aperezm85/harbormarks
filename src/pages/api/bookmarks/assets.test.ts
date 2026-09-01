import { describe, expect, it } from "vitest"

import {
  resolveImageContentType,
  sniffImageContentType,
} from "./assets"

const signatures: Array<{ name: string; body: Buffer; expected: string }> = [
  { name: "PNG", body: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]), expected: "image/png" },
  { name: "JPEG", body: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]), expected: "image/jpeg" },
  { name: "GIF87a", body: Buffer.from("GIF87a"), expected: "image/gif" },
  { name: "GIF89a", body: Buffer.from("GIF89a"), expected: "image/gif" },
  { name: "WebP", body: Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP")]), expected: "image/webp" },
  { name: "ICO (1x1)", body: Buffer.from([0x00, 0x00, 0x01, 0x00]), expected: "image/x-icon" },
   { name: "ICO (2x2)", body: Buffer.from([0x00, 0x00, 0x02, 0x00]), expected: "image/x-icon" },
  { name: "BMP", body: Buffer.concat([Buffer.from([0x42, 0x4d]), Buffer.alloc(10)]), expected: "image/bmp" },
]

describe("sniffImageContentType", () => {
  for (const { name, body, expected } of signatures) {
    it(`identifies ${name}`, () => {
      expect(sniffImageContentType(body)).toBe(expected)
        })
}

  it("identifies SVG from its markup", () => {
    expect(sniffImageContentType(Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"))).toBe("image/svg+xml")
     })

  it("returns null for an HTML error page", () => {
    const html = Buffer.from(
        "<!DOCTYPE html><html><body><h1>Just a moment</h1><p>Attention Required</p></body></html>",
        "utf8"
         )

    expect(sniffImageContentType(html)).toBeNull()
      })
})

describe("resolveImageContentType", () => {
  it("passes through a declared image/* content type unchanged", () => {
    expect(
        resolveImageContentType("image/png", Buffer.from("not real image bytes"))
         ).toBe("image/png")
       })

  it("sniffs the body when no content type is declared", () => {
    expect(
        resolveImageContentType("", Buffer.from("GIF89a"))
         ).toBe("image/gif")
     })
})
