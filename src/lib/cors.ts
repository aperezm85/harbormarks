type Env = Record<string, string | undefined>

const ALLOWED_METHODS = "GET,POST,PUT,DELETE,OPTIONS"
const ALLOWED_HEADERS = "Authorization,Content-Type"

export function getCorsOrigins(env: Env = process.env): string[] {
  return (env.HARBOR_CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim().toLowerCase())
    .filter(Boolean)
}

function normalizeOrigin(value: string): string | null {
  try {
    const parsed = new URL(value)
    // URL.origin is "null" for non-http(s) schemes such as
    // chrome-extension://, so rebuild scheme://host manually.
    if (!parsed.protocol || !parsed.host) {
      return null
    }
    return `${parsed.protocol}//${parsed.host}`.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Build CORS response headers for `/api/*` routes.
 *
 * Returns null when no CORS headers are needed: requests without an Origin
 * (curl, iOS Shortcuts, MV3 service workers) are not browser-cross-origin
 * reads, and same-origin browser requests need no ACAO header.
 * Returns null as well when the Origin is not allow-listed (fail closed).
 */
export function buildCorsHeaders(
  request: Request,
  env: Env = process.env
): Record<string, string> | null {
  const origin = request.headers.get("origin")
  if (!origin) {
    return null
  }
  const normalized = normalizeOrigin(origin)
  if (!normalized) {
    return null
  }
  const allowed = getCorsOrigins(env)
  if (!allowed.includes(normalized)) {
    return null
  }
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
  }
}
