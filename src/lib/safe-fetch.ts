import { lookup } from "node:dns/promises"
import { request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import { isIP } from "node:net"

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

type SafeFetchOptions = {
  timeoutMs?: number
  maxBytes?: number
  maxRedirects?: number
  headers?: Record<string, string>
}

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
  const maxBytes = options.maxBytes ?? 256 * 1024
  const timeoutMs = options.timeoutMs ?? 8000

  return new Promise<{
    statusCode: number
    headers: Record<string, string | string[] | undefined>
    body: Buffer
  }>((resolve, reject) => {
    const request = requestFactory(requestOptions, (response) => {
      const chunks: Buffer[] = []
      let totalBytes = 0

      response.on("data", (chunk: Buffer) => {
        totalBytes += chunk.length

        if (totalBytes > maxBytes) {
          request.destroy(new Error("Response too large"))
          return
        }

        chunks.push(chunk)
      })

      response.on("end", () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          headers: response.headers,
          body: Buffer.concat(chunks),
        })
      })
    })

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("Request timed out"))
    })

    request.on("error", (error) => {
      reject(error)
    })

    request.end()
  })
}

async function fetchTextInternal(
  input: string,
  options: SafeFetchOptions,
  redirectCount: number
): Promise<SafeFetchResult> {
  const parsedUrl = parseHttpUrl(input)
  const resolvedAddress = await resolveSafeAddress(parsedUrl)
  const response = await collectResponseText(
    parsedUrl,
    resolvedAddress,
    options
  )
  const location = response.headers.location

  if (
    response.statusCode >= 300 &&
    response.statusCode < 400 &&
    location &&
    redirectCount < (options.maxRedirects ?? 3)
  ) {
    const nextLocation = Array.isArray(location) ? location[0] : location
    const redirectedUrl = new URL(nextLocation, parsedUrl)
    return fetchTextInternal(
      redirectedUrl.toString(),
      options,
      redirectCount + 1
    )
  }

  return {
    url: parsedUrl.toString(),
    status: response.statusCode,
    ok: response.statusCode >= 200 && response.statusCode < 300,
    contentType: Array.isArray(response.headers["content-type"])
      ? (response.headers["content-type"][0] ?? "")
      : (response.headers["content-type"] ?? ""),
    text: response.body.toString("utf8"),
  }
}

async function fetchBinaryInternal(
  input: string,
  options: SafeFetchOptions,
  redirectCount: number
): Promise<SafeFetchBinaryResult> {
  const parsedUrl = parseHttpUrl(input)
  const resolvedAddress = await resolveSafeAddress(parsedUrl)
  const response = await collectResponseText(
    parsedUrl,
    resolvedAddress,
    options
  )
  const location = response.headers.location

  if (
    response.statusCode >= 300 &&
    response.statusCode < 400 &&
    location &&
    redirectCount < (options.maxRedirects ?? 3)
  ) {
    const nextLocation = Array.isArray(location) ? location[0] : location
    const redirectedUrl = new URL(nextLocation, parsedUrl)
    return fetchBinaryInternal(
      redirectedUrl.toString(),
      options,
      redirectCount + 1
    )
  }

  return {
    url: parsedUrl.toString(),
    status: response.statusCode,
    ok: response.statusCode >= 200 && response.statusCode < 300,
    contentType: Array.isArray(response.headers["content-type"])
      ? (response.headers["content-type"][0] ?? "")
      : (response.headers["content-type"] ?? ""),
    body: response.body,
  }
}

export async function fetchTextSafely(
  input: string,
  options: SafeFetchOptions = {}
) {
  return fetchTextInternal(input, options, 0)
}

export async function fetchBinarySafely(
  input: string,
  options: SafeFetchOptions = {}
) {
  return fetchBinaryInternal(input, options, 0)
}
