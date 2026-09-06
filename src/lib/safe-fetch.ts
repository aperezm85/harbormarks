import { lookup } from "node:dns/promises"
import { request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import { isIP } from "node:net"
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib"

type SafeFetchResult = {
  url: string
  status: number
  ok: boolean
  contentType: string
  text: string
}

type SafeFetchBinaryResult = {
  url: string
  status: number
  ok: boolean
  contentType: string
  body: Buffer
}

/**
 * Raw response payload with the charset resolved from the `content-type`
 * header. When the header does not declare a charset, `rawCharset` is `null`
 * and callers should call {@link resolveCharset} (which also scans the leading
 * bytes of the body for a `<meta charset>` hint) before decoding.
 *
 * `truncated` is true when the body was cut at `maxBytes`. The leading bytes
 * (where `<head>` lives) are always kept, so metadata extraction still works.
 */
type SafeFetchRawResult = {
  url: string
  status: number
  ok: boolean
  contentType: string
  body: Buffer
  rawCharset: string | null
  truncated: boolean
}

type SafeFetchOptions = {
  timeoutMs?: number
  maxBytes?: number
  maxRedirects?: number
  headers?: Record<string, string>
}

const DEFAULT_MAX_BYTES = 1024 * 1024
const DEFAULT_MAX_REDIRECTS = 8
const DEFAULT_TIMEOUT_MS = 8000

function parseHttpUrl(value: string) {
  const parsed = new URL(value)

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid protocol")
  }

  if (parsed.username || parsed.password) {
    throw new Error("Credentials are not allowed")
  }

  return parsed
}

function normalizeHost(hostname: string) {
  return hostname.replace(/^\[(.*)\]$/, "$1").toLowerCase()
}

function isBlockedIpv4(address: string) {
  const parts = address.split(".").map((part) => Number(part))

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true
  }

  const [first, second] = parts

  if (first === 0 || first === 10) {
    return true
  }

  if (first === 127 || (first === 169 && second === 254)) {
    return true
  }

  if (first === 172 && second >= 16 && second <= 31) {
    return true
  }

  if (first === 192 && second === 168) {
    return true
  }

  if (first === 100 && second >= 64 && second <= 127) {
    return true
  }

  if (first >= 224) {
    return true
  }

  return false
}

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase()

  if (normalized === "::" || normalized === "::1") {
    return true
  }

  if (normalized.startsWith("::ffff:")) {
    return isBlockedAddress(normalized.slice(7))
  }

  if (
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff")
  ) {
    return true
  }

  return false
}

function isBlockedAddress(address: string): boolean {
  if (isIP(address) === 4) {
    return isBlockedIpv4(address)
  }

  if (isIP(address) === 6) {
    return isBlockedIpv6(address)
  }

  return true
}

async function resolveSafeAddress(parsedUrl: URL) {
  const hostname = normalizeHost(parsedUrl.hostname)

  if (!hostname || hostname === "localhost") {
    throw new Error("Blocked host")
  }

  if (isIP(hostname)) {
    if (isBlockedAddress(hostname)) {
      throw new Error("Blocked address")
    }

    return hostname
  }

  const addresses = await lookup(hostname, { all: true })

  if (!addresses.length) {
    throw new Error("Unable to resolve host")
  }

  const resolved = addresses.map((entry) => entry.address)

  if (resolved.some((address) => isBlockedAddress(address))) {
    throw new Error("Blocked address")
  }

  return resolved[0]
}

type CollectedResponse = {
  statusCode: number
  headers: Record<string, string | string[] | undefined>
  body: Buffer
  truncated: boolean
}

/**
 * Perform the HTTP request and collect the body up to `maxBytes`.
 *
 * When the body exceeds the cap we keep the first `maxBytes` bytes, stop
 * reading, and resolve with `truncated: true` — we do NOT reject. The
 * document `<head>` is always at the top, so callers that only need metadata
 * still get everything they need from a truncated body.
 */
function collectResponseText(
  parsedUrl: URL,
  resolvedAddress: string,
  options: SafeFetchOptions
) {
  const isHttps = parsedUrl.protocol === "https:"
  const requestOptions = {
    hostname: resolvedAddress,
    port: parsedUrl.port ? Number(parsedUrl.port) : isHttps ? 443 : 80,
    path: `${parsedUrl.pathname}${parsedUrl.search}`,
    method: "GET" as const,
    headers: {
      host: parsedUrl.host,
      connection: "close",
      "accept-encoding": "identity",
      "user-agent": "HarborMarksBot/1.0 (+safe-fetch)",
      accept: "text/html, text/plain;q=0.9, application/xml;q=0.8, */*;q=0.1",
      ...(options.headers ?? {}),
    },
    servername: parsedUrl.hostname,
  }
  const requestFactory = isHttps ? httpsRequest : httpRequest
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return new Promise<CollectedResponse>((resolve, reject) => {
    let settled = false
    const done = (fn: () => void) => {
      if (!settled) {
        settled = true
        fn()
      }
    }

    const request = requestFactory(requestOptions, (response) => {
      const chunks: Buffer[] = []
      let totalBytes = 0

      const finish = (truncated: boolean) =>
        done(() =>
          resolve({
            statusCode: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks),
            truncated,
          })
        )

      response.on("data", (chunk: Buffer) => {
        if (settled) {
          return
        }

        const remaining = maxBytes - totalBytes
        if (chunk.length >= remaining) {
          chunks.push(chunk.subarray(0, remaining))
          totalBytes = maxBytes
          finish(true)
          // Stop the download without raising an error on the request.
          response.destroy()
          return
        }

        chunks.push(chunk)
        totalBytes += chunk.length
      })

      response.on("end", () => finish(false))
      response.on("error", (error) => done(() => reject(error)))
    })

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("Request timed out"))
    })

    request.on("error", (error) => done(() => reject(error)))

    request.end()
  })
}

/**
 * Best-effort decompression for servers that ignore `accept-encoding:
 * identity`. A truncated compressed stream will fail to inflate; in that case
 * we return the raw bytes and let the caller fall back.
 */
function decodeContentEncoding(body: Buffer, encodingHeader: string): Buffer {
  const encoding = encodingHeader.trim().toLowerCase()

  if (!encoding || encoding === "identity") {
    return body
  }

  try {
    if (encoding === "gzip" || encoding === "x-gzip") {
      return gunzipSync(body)
    }
    if (encoding === "br") {
      return brotliDecompressSync(body)
    }
    if (encoding === "deflate") {
      return inflateSync(body)
    }
  } catch {
    // fall through
  }

  return body
}

/**
 * Known charset aliases Node's `TextDecoder` does not accept by their legacy
 * spelling but which map onto a supported encoding. The Windows-1252 mapping
 * uses a strict superset of ISO-8859-1 so more bytes decode losslessly.
 */
const CHARSET_ALIASES: Record<string, string> = {
  "win-1252": "windows-1252",
  cp850: "windows-1250",
  cp1252: "windows-1252",
  "iso-8859-1": "windows-1252",
}

/**
 * Extract the `charset=` parameter from a `content-type` header value.
 *
 * Matching is case-insensitive, stops at the next parameter separator (`;`),
 * and strips a single pair of surrounding quotes plus surrounding spaces.
 * Returns the lowercased charset, or `null` when the header is absent or
 * declares no usable charset. This is a pure string operation (no regex, no
 * HTML parsing) and is exported so it can be unit tested in isolation.
 */
export function parseCharsetFromString(contentType: string): string | null {
  const trimmed = contentType.trim()
  if (trimmed.length === 0) {
    return null
  }

  const lower = trimmed.toLowerCase()
  const word = "charset"
  let from = 0

  // Walk every "charset" occurrence, tolerating optional whitespace around the
  // "=" (HTTP parameter syntax permits spaces there).
  while (true) {
    const at = lower.indexOf(word, from)
    if (at === -1) {
      return null
    }

    let i = at + word.length
    while (i < lower.length && lower[i] === " ") {
      i += 1
    }

    if (i < lower.length && lower[i] === "=") {
      i += 1
      while (i < lower.length && lower[i] === " ") {
        i += 1
      }

      const rest = lower.slice(i)
      const separator = rest.indexOf(";")
      let raw = separator === -1 ? rest : rest.slice(0, separator)
      raw = raw.trim()

      // Strip a single pair of surrounding quotes when present.
      if (raw.length >= 2) {
        const first = raw[0]
        const last = raw[raw.length - 1]
        if (
          (first === '"' && last === '"') ||
          (first === "'" && last === "'")
        ) {
          raw = raw.slice(1, -1)
        }
      }

      raw = raw.trim()
      return raw.length > 0 ? raw : null
    }

    from = at + word.length
  }
}

/**
 * Attribute-based scan of `<meta charset=...>`. This deliberately reads the
 * charset as a known HTML attribute via plain `Buffer` sub-sequence search and
 * character slicing — NOT via any HTML-tag regex — per the Story 7 spec.
 *
 * Returns the lowercased charset, or `null` when no meta tag is found.
 */
function readMetaCharsetFromHead(head: string): string | null {
  const marker = "<meta charset="
  const lower = head.toLowerCase()
  let index = lower.indexOf(marker)

  while (index !== -1) {
    const length = head.length
    let position = index + marker.length

    // A quoted attribute skips its opening quote; the read then stops at the
    // matching close quote, or at a space / ">" / ";" delimiter.
    if (position < length) {
      const first = head[position]
      if (first === '"' || first === "'") {
        position += 1
      }
    }

    const valueStart = position
    while (position < length) {
      const ch = head[position]
      if (
        ch === '"' ||
        ch === "'" ||
        ch === " " ||
        ch === "\t" ||
        ch === ">" ||
        ch === ";" ||
        ch === "\n" ||
        ch === "\r"
      ) {
        break
      }
      position += 1
    }

    const value = head.slice(valueStart, position).trim().toLowerCase()
    if (value.length > 0) {
      return value
    }

    index = lower.indexOf(marker, index + marker.length)
  }

  return null
}

/**
 * Resolve the charset for a fetched text body:
 *   1. Use the charset declared in the `content-type` header when present.
 *   2. Otherwise scan the first 1 KB of the body (decoded as Latin-1, so the
 *      byte values are meaningful) for a `<meta charset=...>` attribute.
 *   3. Otherwise fall back to UTF-8.
 *
 * `body` is typed as `Buffer` (the production shape); a plain string is
 * accepted for convenience in tests and is treated as Latin-1 bytes.
 */
export function resolveCharset(contentType: string, body: Buffer): string {
  const declared = parseCharsetFromString(contentType)
  if (declared) {
    return declared
  }

  const buffer = Buffer.isBuffer(body)
    ? body
    : Buffer.from(String(body), "latin1")

  if (buffer.length > 0) {
    const head = buffer
      .subarray(0, Math.min(1024, buffer.length))
      .toString("latin1")
    const fromMeta = readMetaCharsetFromHead(head)
    if (fromMeta) {
      return fromMeta
    }
  }

  return "utf-8"
}

/**
 * Decode a body using an explicit charset.
 *
 * Normalizes legacy spelling and separates underscore/hyphen variants against
 * a small alias map (so e.g. "iso-8859-1" decodes via the lossless
 * "windows-1252" superset). On any unsupported label it falls back to UTF-8
 * with `fatal: false` so undecodable bytes are retained rather than dropped.
 */
export function decodeWithCharset(body: Buffer, charset: string): string {
  const key = charset.trim().toLowerCase().split("_").join("-")
  const label = CHARSET_ALIASES[key] ?? key

  try {
    return new TextDecoder(label, { fatal: false }).decode(body)
  } catch {
    try {
      return new TextDecoder("windows-1252", { fatal: false }).decode(body)
    } catch {
      return new TextDecoder("utf-8", { fatal: false }).decode(body)
    }
  }
}

/**
 * Shared fetch core. Performs the URL/credential validation, the SSRF address
 * resolution, the byte-capped response collection, and the redirect loop, then
 * resolves the charset from the `content-type` header. All public fetchers
 * delegate to this so they share a single guard implementation — the raw path
 * is therefore not an SSRF bypass.
 */
async function fetchRawInternal(
  input: string,
  options: SafeFetchOptions,
  redirectCount: number
): Promise<SafeFetchRawResult> {
  const parsedUrl = parseHttpUrl(input)
  const resolvedAddress = await resolveSafeAddress(parsedUrl)
  const response = await collectResponseText(
    parsedUrl,
    resolvedAddress,
    options
  )
  const location = response.headers.location
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS

  if (response.statusCode >= 300 && response.statusCode < 400 && location) {
    if (redirectCount >= maxRedirects) {
      throw new Error(`Too many redirects (limit ${maxRedirects})`)
    }

    const nextLocation = Array.isArray(location) ? location[0] : location
    const redirectedUrl = new URL(nextLocation, parsedUrl)
    return fetchRawInternal(
      redirectedUrl.toString(),
      options,
      redirectCount + 1
    )
  }

  const contentType = Array.isArray(response.headers["content-type"])
    ? (response.headers["content-type"][0] ?? "")
    : (response.headers["content-type"] ?? "")

  const contentEncoding = Array.isArray(response.headers["content-encoding"])
    ? (response.headers["content-encoding"][0] ?? "")
    : (response.headers["content-encoding"] ?? "")

  const body = decodeContentEncoding(response.body, contentEncoding)

  return {
    url: parsedUrl.toString(),
    status: response.statusCode,
    ok: response.statusCode >= 200 && response.statusCode < 300,
    contentType,
    body,
    rawCharset: parseCharsetFromString(contentType),
    truncated: response.truncated,
  }
}

/**
 * Fetch a URL as text. The body is always decoded as UTF-8 (pre-decoded into
 * `text`); callers that need to honor a non-UTF-8 charset must use
 * {@link fetchRawSafely} together with {@link resolveCharset} and
 * {@link decodeWithCharset} instead.
 */
export async function fetchTextSafely(
  input: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult> {
  const result = await fetchRawInternal(input, options, 0)

  return {
    url: result.url,
    status: result.status,
    ok: result.ok,
    contentType: result.contentType,
    text: result.body.toString("utf8"),
  }
}

/**
 * Fetch a URL as raw bytes, leaving decoding to the caller. The `body` is a
 * `Buffer`; no charset is assumed.
 */
export async function fetchBinarySafely(
  input: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchBinaryResult> {
  const result = await fetchRawInternal(input, options, 0)

  return {
    url: result.url,
    status: result.status,
    ok: result.ok,
    contentType: result.contentType,
    body: result.body,
  }
}

/**
 * Fetch a URL as raw bytes and resolve the charset declared in the
 * `content-type` header via {@link parseCharsetFromString}. When the header
 * declares no charset, `rawCharset` is `null` and callers should pass the
 * result through {@link resolveCharset} (which also inspects the body's leading
 * bytes) before {@link decodeWithCharset}.
 *
 * This path is NOT an SSRF bypass: it shares `parseHttpUrl` and
 * `resolveSafeAddress` with every other fetcher.
 */
export async function fetchRawSafely(
  input: string,
  options: SafeFetchOptions = {}
) {
  return fetchRawInternal(input, options, 0)
}
