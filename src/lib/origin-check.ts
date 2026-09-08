/**
 * Runtime CSRF origin check.
 *
 * Astro resolves `security.checkOrigin` and `security.allowedDomains` while
 * `astro build` runs and freezes the result into the build manifest. A prebuilt
 * image therefore ships with whatever the build machine had set, and no runtime
 * environment variable can change it. Self-hosters pull a published image, so
 * the check has to be evaluated per request instead — that is what this module
 * does, mirroring Astro's own semantics.
 *
 * Configuration (read on every request):
 * - `HARBOR_CHECK_ORIGIN=false` disables the check entirely.
 * - `HARBOR_ALLOWED_DOMAINS` is a comma-separated list of hostnames that are
 *   trusted in addition to the request's own origin. Required when a reverse
 *   proxy terminates TLS on a public hostname and forwards to a different
 *   internal host or port.
 */

const FORM_CONTENT_TYPES = [
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "text/plain",
]

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"]

type Env = Record<string, string | undefined>

export function isOriginCheckEnabled(env: Env = process.env): boolean {
  return env.HARBOR_CHECK_ORIGIN !== "false"
}

export function getAllowedHostnames(env: Env = process.env): string[] {
  return (env.HARBOR_ALLOWED_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean)
}

function hasFormLikeHeader(contentType: string): boolean {
  const normalized = contentType.toLowerCase()
  return FORM_CONTENT_TYPES.some((formType) => normalized.includes(formType))
}

function isTrustedOrigin(
  origin: string | null,
  url: URL,
  allowedHostnames: string[],
): boolean {
  if (origin === null) {
    return false
  }

  if (origin === url.origin) {
    return true
  }

  if (allowedHostnames.length === 0) {
    return false
  }

  try {
    return allowedHostnames.includes(new URL(origin).hostname.toLowerCase())
  } catch {
    // A malformed Origin header is never trusted.
    return false
  }
}

export function isForbiddenCrossOriginRequest(
  request: Request,
  url: URL,
  isPrerendered: boolean,
  env: Env = process.env,
): boolean {
  if (isPrerendered || SAFE_METHODS.includes(request.method)) {
    return false
  }

  if (!isOriginCheckEnabled(env)) {
    return false
  }

  const trusted = isTrustedOrigin(
    request.headers.get("origin"),
    url,
    getAllowedHostnames(env),
  )

  const contentType = request.headers.get("content-type")

  // Requests with a non form-like content type (JSON, for example) cannot be
  // sent cross-origin without a CORS preflight, so the browser already
  // protects them. This mirrors Astro's built-in behaviour.
  if (contentType !== null) {
    return hasFormLikeHeader(contentType) && !trusted
  }

  return !trusted
}

export function createCrossOriginForbiddenResponse(request: Request): Response {
  return new Response(
    `Cross-site ${request.method} form submissions are forbidden`,
    { status: 403 },
  )
}
