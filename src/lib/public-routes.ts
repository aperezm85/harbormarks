const PUBLIC_PATHS = new Set([
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/robots.txt",
  "/healthz",
  "/api/healthz",
  "/api/digest/run",
])

export function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) {
    return true
  }

  if (pathname.startsWith("/api/auth/")) {
    return true
  }

  if (/^\/api\/bookmarks\/\d+\/open$/.test(pathname)) {
    return true
  }

  if (
    pathname.startsWith("/assets") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/_astro")
  ) {
    return true
  }

  return false
}
