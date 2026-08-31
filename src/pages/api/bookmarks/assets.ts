import type { APIRoute } from "astro"
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { fetchBinarySafely } from "@/lib/safe-fetch"

const CACHE_DIR = join(process.cwd(), ".harbormarks-cache", "bookmark-assets")

type CachedAssetRecord = {
  contentType: string
}

import { normalizeBookmarkUrl } from "@/lib/bookmark-url"

function parseAndValidateUrl(value: string | null) {
  return normalizeBookmarkUrl(value)
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

function isImageContentType(contentType: string) {
  return contentType.toLowerCase().startsWith("image/")
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

  if (!response.ok || !isImageContentType(response.contentType)) {
    return new Response(JSON.stringify({ error: "Unable to fetch asset" }), {
      status: 404,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  await writeCachedAsset(assetUrl, response.body, response.contentType)

  return new Response(new Uint8Array(response.body), {
    status: 200,
    headers: {
      "content-type": response.contentType,
      "cache-control": "public, max-age=31536000, immutable",
    },
  })
}
