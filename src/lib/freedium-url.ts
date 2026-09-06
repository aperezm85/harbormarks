/**
 * Unwrap a Freedium mirror URL to the inner article URL.
 *
 * Freedium mirrors encode the original article as a path suffix, e.g.
 * `https://freedium-mirror.cfd/https://example.medium.com/some-post-abc123`.
 * Fetching the mirror's own HTML yields mirror chrome (or a challenge page),
 * so metadata should be sourced from the inner URL instead.
 *
 * Detection: hostname contains `freedium` (covers freedium-mirror.cfd and any
 * future freedium host) AND the URL carries an inner `http(s)://...` after
 * the first `/https://` or `/http://` segment. Percent-encoded inner URLs
 * (e.g. `/https%3A%2F%2F...`) are decoded before validation.
 *
 * Returns the inner `URL` on success, or `null` when the input is not a
 * Freedium mirror URL or the inner URL does not validate.
 */
export function unwrapFreediumUrl(input: URL | string): URL | null {
  let url: URL
  try {
    url = typeof input === "string" ? new URL(input) : input
  } catch {
    return null
  }

  if (!url.hostname.toLowerCase().includes("freedium")) {
    return null
  }

  // Candidates: raw href first, then a percent-decoded variant so encoded
  // inner URLs (`/https%3A%2F%2F...`) are handled too.
  const candidates: string[] = [url.href]
  try {
    const decoded = decodeURIComponent(url.href)
    if (decoded !== url.href) {
      candidates.push(decoded)
    }
  } catch {
    // Malformed percent-encoding — just try the raw href.
  }

  for (const candidate of candidates) {
    const match = candidate.match(/\/(https?:\/\/.+)$/)
    if (!match?.[1]) {
      continue
    }
    const innerRaw = match[1].trim()
    if (!innerRaw) {
      continue
    }
    try {
      const inner = new URL(innerRaw)
      if (inner.protocol !== "http:" && inner.protocol !== "https:") {
        continue
      }
      return inner
    } catch {
      continue
    }
  }

  return null
}
