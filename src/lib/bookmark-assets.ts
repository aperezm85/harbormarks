const BOOKMARK_ASSET_ROUTE = "/api/bookmarks/assets"

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

export function isBookmarkAssetProxyUrl(value: string) {
  return value.startsWith(`${BOOKMARK_ASSET_ROUTE}?url=`)
}

export function createBookmarkAssetProxyUrl(assetUrl: string) {
  return `${BOOKMARK_ASSET_ROUTE}?url=${encodeURIComponent(assetUrl)}`
}

export function normalizeBookmarkAssetUrl(value: string | null | undefined) {
  if (!value) {
    return value ?? null
  }

  if (
    value.startsWith("/") ||
    value.startsWith("data:") ||
    value.startsWith("blob:") ||
    isBookmarkAssetProxyUrl(value)
  ) {
    return value
  }

  return isHttpUrl(value) ? createBookmarkAssetProxyUrl(value) : value
}
