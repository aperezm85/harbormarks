import type { APIRoute } from "astro"
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { fetchBinarySafely } from "@/lib/safe-fetch"

const CACHE_DIR = join(process.cwd(), ".harbormarks-cache", "bookmark-assets")

type CachedAssetRecord = {
  contentType: string
}

// Asset URLs are fetch targets, not bookmark identities: keep them byte-for-byte
// as stored. normalizeBookmarkUrl() is for dedupe canonicalisation and would strip
// "www.", drop query params and re-sort the query string, breaking real asset hosts.
function parseAndValidateUrl(value: string | null) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const hasProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed)
  const normalizedValue = hasProtocol ? trimmed : `https://${trimmed}`

  try {
    const parsed = new URL(normalizedValue)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null
    }

    return parsed.toString()
  } catch {
    return null
  }
}

function createCacheKey(url: string) {
  return createHash("sha256").update(url).digest("hex")
}

async function readCachedAsset(url: string) {
  const key = createCacheKey(url)
  const recordPath = join(CACHE_DIR, `${key}.json`)
  const bodyPath = join(CACHE_DIR, `${key}.bin`)

  try {
    const [recordText, body] = await Promise.all([
      readFile(recordPath, "utf8"),
      readFile(bodyPath),
    ])

    const record = JSON.parse(recordText) as CachedAssetRecord
    if (!record.contentType) {
      return null
    }

    return {
      body,
      contentType: record.contentType,
    }
  } catch {
    return null
  }
}

async function writeCachedAsset(
  url: string,
  body: Buffer,
  contentType: string
) {
  const key = createCacheKey(url)
  const recordPath = join(CACHE_DIR, `${key}.json`)
  const bodyPath = join(CACHE_DIR, `${key}.bin`)

  await mkdir(CACHE_DIR, { recursive: true })
  await Promise.all([
    writeFile(recordPath, JSON.stringify({ contentType } as CachedAssetRecord)),
    writeFile(bodyPath, body),
  ])
}

function startsWithBytes(body: Buffer, bytes: number[]) {
  if (body.length < bytes.length) {
    return false
  }

  return bytes.every((byte, index) => body[index] === byte)
}

function readAscii(body: Buffer, start: number, end: number) {
  return body.subarray(start, end).toString("latin1")
}

// Some origins serve images with an empty or generic content-type (a real example:
// freedium-mirror.cfd returns `content-type:` with no value for its favicon), so
// fall back to the file signature rather than rejecting the asset.
export function sniffImageContentType(body: Buffer) {
  if (startsWithBytes(body, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png"
  }

  if (startsWithBytes(body, [0xff, 0xd8, 0xff])) {
    return "image/jpeg"
  }

  if (startsWithBytes(body, [0x00, 0x00, 0x01, 0x00])) {
    return "image/x-icon"
  }

  if (startsWithBytes(body, [0x00, 0x00, 0x02, 0x00])) {
    return "image/x-icon"
  }

  if (startsWithBytes(body, [0x42, 0x4d])) {
    return "image/bmp"
  }

  const header = readAscii(body, 0, 12)

  if (header.startsWith("GIF87a") || header.startsWith("GIF89a")) {
    return "image/gif"
  }

  if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") {
    return "image/webp"
  }

  if (readAscii(body, 4, 8) === "ftyp") {
    const brand = readAscii(body, 8, 12)

    if (brand.startsWith("avif") || brand.startsWith("avis")) {
      return "image/avif"
    }

    if (brand.startsWith("heic") || brand.startsWith("heix")) {
      return "image/heic"
    }
  }

  const textHead = readAscii(body, 0, Math.min(body.length, 1024))
  if (/<svg[\s>]/i.test(textHead)) {
    return "image/svg+xml"
  }

  return null
}

export function resolveImageContentType(contentType: string, body: Buffer) {
  if (contentType.trim().toLowerCase().startsWith("image/")) {
    return contentType
     }

  return sniffImageContentType(body)
}

export const GET: APIRoute = async ({ request, locals }) => {
  if (!locals.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  const requestUrl = new URL(request.url)
  const assetUrl = parseAndValidateUrl(requestUrl.searchParams.get("url"))

  if (!assetUrl) {
    return new Response(JSON.stringify({ error: "Invalid or missing url" }), {
      status: 400,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  const cachedAsset = await readCachedAsset(assetUrl)
  if (cachedAsset) {
    return new Response(cachedAsset.body, {
      status: 200,
      headers: {
        "content-type": cachedAsset.contentType,
        "cache-control": "public, max-age=31536000, immutable",
      },
    })
  }

  const response = await fetchBinarySafely(assetUrl, {
    timeoutMs: 8000,
    maxBytes: 2 * 1024 * 1024,
    maxRedirects: 3,
    headers: {
      "user-agent": "HarborMarksBot/1.0 (+bookmark-assets)",
      accept: "image/*,*/*;q=0.1",
    },
  })

  const resolvedContentType = response.ok
    ? resolveImageContentType(response.contentType, response.body)
    : null

  if (!resolvedContentType) {
    return new Response(JSON.stringify({ error: "Unable to fetch asset" }), {
      status: 404,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  await writeCachedAsset(assetUrl, response.body, resolvedContentType)

  return new Response(new Uint8Array(response.body), {
    status: 200,
    headers: {
      "content-type": resolvedContentType,
      "cache-control": "public, max-age=31536000, immutable",
    },
  })
}
