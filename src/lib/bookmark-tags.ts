// Tag parsing/normalization is pure and shared by the data layer, so it lives in
// its own module free of the database client (which bootstraps a connection at
// import time). Mirrored in SQL by migrations/0002_tags_array.sql.

export function parseTags(rawTags: string[] | string | null): string[] {
  if (!rawTags) {
    return []
   }

  if (Array.isArray(rawTags)) {
    return rawTags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)
   }

  try {
    const parsed = JSON.parse(rawTags)
    if (Array.isArray(parsed)) {
      return parsed.filter((tag): tag is string => typeof tag === "string")
     }
   } catch {
    // Fall through to comma-separated parsing.
   }

  return rawTags
     .split(",")
     .map((tag) => tag.trim())
     .filter(Boolean)
}

export function normalizeTags(tags?: string[] | string | null) {
  if (!tags) {
    return null
   }

  if (Array.isArray(tags)) {
    const normalized = tags.map((tag) => tag.trim()).filter(Boolean)

    return normalized.length > 0 ? normalized : null
   }

  const normalized = tags
     .split(",")
     .map((tag) => tag.trim())
     .filter(Boolean)

  return normalized.length > 0 ? normalized : null
}
