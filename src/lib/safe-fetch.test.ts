import { describe, expect, it, vi, beforeEach } from "vitest"

import {
  fetchBinarySafely,
  fetchRawSafely,
  fetchTextSafely,
  parseCharsetFromString,
  resolveCharset,
  decodeWithCharset,
} from "./safe-fetch"

/**
 * The SUT talks to the `node:http` / `node:https` request and `node:dns/promises`
 * lookup layers. We mock both so no real socket is opened:
 *
 * - `lookup` returns a fixed public address so `resolveSafeAddress` passes its
 *   SSRF guard.
 * - `request` returns a fake request that emits a prepared response body and
 *   headers via queued microtasks, mirroring the real stream contract the SUT
 *   relies on (`on("data")`, `on("end")`, `on("error")`, `setTimeout`, `end`).
 *
 * `vi.hoisted` is what lets the module-level `vi.mock` factories reference the
 * shared `harness` state.
 */
const harness = vi.hoisted(() => {
  type Spec = {
    statusCode: number
    headers: Record<string, string>
    body: Buffer
    }

  const state = {
    current: { statusCode: 200, headers: {}, body: Buffer.alloc(0) } as Spec,
    lookup: async () => [
       { address: "9.9.9.9", family: 4 },
      ] as const,
    request(_options: unknown, onResponse: (response: unknown) => void): object {
       const prepared = state.current
       const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
       let errCb: ((...args: unknown[]) => void) | undefined

       const response = {
         statusCode: prepared.statusCode,
         headers: prepared.headers,
         on(event: string, cb: (...args: unknown[]) => void) {
            ;(listeners[event] ||= []).push(cb)
           return response
             },
          }

       const request = {
         setTimeout() {},
         on(event: string, cb: (...args: unknown[]) => void) {
           if (event === "error") {
              errCb = cb
                }
           return request
             },
         destroy(err?: Error) {
           if (err && errCb) {
              errCb(err)
                }
             },
         end() {},
          }

         // The real ClientRequest is synchronous; deliver the response body over
         // the next microtask so the SUT's stream listeners fire after register.
       queueMicrotask(() => {
         onResponse(response)
         queueMicrotask(() => {
            ;(listeners.data || []).forEach((cb) => cb(prepared.body))
            ;(listeners.end || []).forEach((cb) => cb())
             })
          })

       return request
         },
    setSpec(spec: Spec) {
      state.current = spec
      },
    }

   return state
})

vi.mock("node:dns/promises", () => ({
  lookup: harness.lookup,
 }))

vi.mock("node:http", () => ({
  request: (...args: unknown[]) =>
   (harness.request(...(args as [object, (response: unknown) => void]))) as object,
 }))

vi.mock("node:https", () => ({
  request: (...args: unknown[]) =>
   (harness.request(...(args as [object, (response: unknown) => void]))) as object,
 }))

function prepare(statusCode: number, headers: Record<string, string>, body: Buffer) {
  harness.setSpec({ statusCode, headers, body })
}

beforeEach(() => {
  harness.setSpec({ statusCode: 200, headers: {}, body: Buffer.alloc(0) })
})

describe("parseCharsetFromString (header charset parsing)", () => {
  it("returns null when the header is absent, empty, or has no charset", () => {
    expect(parseCharsetFromString("")).toBeNull()
    expect(parseCharsetFromString("text/html")).toBeNull()
    expect(parseCharsetFromString("   ")).toBeNull()
    })

  it("parses and lowercases a charset parameter, stripping quotes and spaces", () => {
    expect(parseCharsetFromString("text/html; charset=ISO-8859-1")).toBe(
      "iso-8859-1"
     )
    expect(parseCharsetFromString('text/html; Charset = "windows-1252"')).toBe(
      "windows-1252"
     )
    expect(parseCharsetFromString("text/html; charset=Windows-1252")).toBe(
      "windows-1252"
     )
    })

  it("stops at the next parameter separator", () => {
    expect(parseCharsetFromString("text/html; charset=utf-8; boundary=x")).toBe(
      "utf-8"
     )
    })
})

describe("resolveCharset", () => {
  it("prefers a declared charset and returns it lowercased", () => {
    expect(resolveCharset("text/html; charset=Windows-1252", Buffer.alloc(0))).toBe(
      "windows-1252"
     )
    })

  it("scans the first 1024 bytes for a <meta charset> when the header omits one", () => {
    expect(
      resolveCharset(
        "text/html",
        Buffer.from('<meta charset="utf-8"> rest of body here', "latin1")
       )
     ).toBe("utf-8")
    })

  it("defaults to utf-8 when no hint is present", () => {
    expect(resolveCharset("text/html", Buffer.alloc(0))).toBe("utf-8")
    })
})

describe("decodeWithCharset", () => {
  it("decodes a Windows-1252 byte to the expected character", () => {
     // 0xE9 is "é" in Windows-1252 / ISO-8859-1.
    expect(decodeWithCharset(Buffer.from([0xe9]), "windows-1252")).toBe("é")
    })

  it("decodes utf-8 bytes directly", () => {
    expect(decodeWithCharset(Buffer.from("ok"), "utf-8")).toBe("ok")
    })

  it("maps iso-8859-1 to the windows-1252 superset", () => {
    expect(decodeWithCharset(Buffer.from([0xe9]), "iso-8859-1")).toBe("é")
    })
})

describe("fetchRawSafely (mocked request layer)", () => {
  it("returns a raw Buffer body and the parsed rawCharset", async () => {
     prepare(
      200,
        { "content-type": "text/html; charset=ISO-8859-1" },
        Buffer.from([0xe9, 0xe9, 0xe9])
        )

     const result = await fetchRawSafely("http://example.com/article")

     expect(Buffer.isBuffer(result.body)).toBe(true)
     expect(result.body).toHaveLength(3)
     expect(result.rawCharset).toBe("iso-8859-1")
     expect(result.ok).toBe(true)
     expect(result.status).toBe(200)
     expect(result.contentType).toBe("text/html; charset=ISO-8859-1")

        // Both spellings must decode that charset class. 0xE9 is "é" in
        // Windows-1252 / ISO-8859-1.
     expect(decodeWithCharset(Buffer.from([0xe9]), "windows-1252")).toBe("é")
     expect(decodeWithCharset(Buffer.from([0xe9]), "iso-8859-1")).toBe("é")
    })

  it("reports rawCharset null when the header declares no charset", async () => {
    prepare(200, {}, Buffer.from("abcdefghij", "latin1"))

    const result = await fetchRawSafely("http://example.com/plain")

    expect(result.rawCharset).toBeNull()
    expect(resolveCharset(result.contentType, result.body)).toBe("utf-8")
    })
})

describe("fetchTextSafely / fetchBinarySafely (public signatures unchanged)", () => {
  it("fetchTextSafely still returns a UTF-8 string and contentType", async () => {
    prepare(
      200,
      { "content-type": "text/html; charset=utf-8" },
      Buffer.from("hello world", "utf8")
     )

    const result = await fetchTextSafely("http://example.com/text")

    expect(typeof result.url).toBe("string")
    expect(typeof result.status).toBe("number")
    expect(typeof result.ok).toBe("boolean")
    expect(typeof result.contentType).toBe("string")
    expect(typeof result.text).toBe("string")
    expect(result.text).toBe("hello world")
    expect(result.contentType).toBe("text/html; charset=utf-8")
    })

  it("fetchBinarySafely returns the raw Buffer body with an unchanged shape", async () => {
    prepare(
      200,
      { "content-type": "image/png" },
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
     )

    const result = await fetchBinarySafely("http://example.com/pic.png")

    expect(Buffer.isBuffer(result.body)).toBe(true)
    expect(Array.from(result.body)).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
     ])
    expect(result.contentType).toBe("image/png")
    expect((result as { rawCharset?: unknown }).rawCharset).toBeUndefined()
    })
})

// NOTE: the SSRF blocked-address / blocked-host / credential / protocol guards
// (resolveSafeAddress, parseHttpUrl) are not exercised by these mocked unit
// tests because the mocked `dns.lookup` short-circuits resolution. They are
// untouched by this work unit and are shared via `fetchRawInternal`, so the new
// raw path cannot bypass them.
