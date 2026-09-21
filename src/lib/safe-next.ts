const DUMMY_BASE = "http://harbormarks.local"

/**
 * Whether a `next` redirect target is a safe same-origin path.
 *
 * Accepts paths like `/`, `/save?url=https://example.com/a` (colons and
 * slashes are fine inside the query string). Rejects protocol-relative
 * URLs (`//evil.com`), backslash tricks (`/\\evil`, `/\evil`), absolute
 * URLs, and anything that does not parse back to the dummy base host.
 */
export function isSafeNextPath(value: unknown): boolean {
  if (typeof value !== "string") {
    return false
  }

  const trimmed = value.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return false
  }

  const head = trimmed.split(/[?#]/, 1)[0] ?? ""
  if (head.includes("\\")) {
    return false
  }

  try {
    const parsed = new URL(trimmed, DUMMY_BASE)
    if (parsed.host !== "harbormarks.local") {
      return false
    }
    if (!parsed.pathname.startsWith("/")) {
      return false
    }
    const decoded = decodeURIComponent(parsed.pathname)
    if (decoded.startsWith("//") || decoded.includes("\\")) {
      return false
    }
  } catch {
    return false
  }

  return true
}

/**
 * Resolve a `next` form/query value to a redirect target, falling back when
 * missing or unsafe. Never returns an attacker-controlled URL.
 */
export function resolveNextPath(value: unknown, fallback = "/"): string {
  if (typeof value === "string" && isSafeNextPath(value)) {
    return value.trim()
  }
  return fallback
}
