import { defineMiddleware } from "astro:middleware"

import { getApiKeyUser, parseBearerToken } from "@/lib/api-key"
import { getSessionCookieName, getUserBySessionToken } from "@/lib/auth"
import { buildCorsHeaders } from "@/lib/cors"
import {
  createCrossOriginForbiddenResponse,
  isForbiddenCrossOriginRequest,
} from "@/lib/origin-check"
import { isPublicRoute } from "@/lib/public-routes"
import { resolveNextPath } from "@/lib/safe-next"

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url

  // Runs before anything else so an untrusted origin never reaches a handler.
  // Astro's built-in check is disabled in astro.config.mjs because it is baked
  // in at build time and cannot be configured on a published image.
  if (
    isForbiddenCrossOriginRequest(
      context.request,
      context.url,
      context.isPrerendered
    )
  ) {
    return createCrossOriginForbiddenResponse(context.request)
  }

  // CORS preflight for API clients (browser extension popup). Native
  // clients (curl, iOS Shortcuts, MV3 service workers) send no Origin and
  // need no preflight; buildCorsHeaders returns null for those.
  if (pathname.startsWith("/api/") && context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(context.request) ?? {},
    })
  }

  // Allow static assets
  if (
    pathname.startsWith("/assets") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/_astro")
  ) {
    return next()
  }

  const isLoginPage = pathname === "/login"
  const isRegisterPage = pathname === "/register"
  const isVerifyEmailPage = pathname === "/verify-email"
  const isForgotPasswordPage = pathname === "/forgot-password"
  const isResetPasswordPage = pathname === "/reset-password"
  const isPublicAuthApi = pathname.startsWith("/api/auth/")
  const isHealthCheck = pathname === "/api/healthz" || pathname === "/healthz"
  // Cron-secret endpoint for external schedulers (Uptime Kuma, host cron);
  // authenticated via HARBOR_CRON_SECRET header, not the session cookie.
  const isDigestCronApi = pathname === "/api/digest/run"
  // Signed email click-through (GET /api/bookmarks/:id/open?sig=...);
  // authenticated via HMAC signature, not the session cookie, so logged-out
  // email clicks on any device still record the open.
  const isBookmarkOpenApi = /^\/api\/bookmarks\/\d+\/open$/.test(pathname)
  const isAdminPage = pathname.startsWith("/admin")
  const isAdminApi = pathname.startsWith("/api/admin/")
  const isPublicRoutePath = isPublicRoute(pathname)

  const session = context.cookies.get(getSessionCookieName())?.value
  let user = await getUserBySessionToken(session)
  // Quick-save clients (browser extension, iOS Shortcuts) authenticate with
  // `Authorization: Bearer <api-key>` instead of the session cookie. Session
  // wins when both are present; key-management routes reject Bearer explicitly.
  if (!user) {
    const bearer = parseBearerToken(
      context.request.headers.get("authorization")
    )
    if (bearer) {
      user = await getApiKeyUser(bearer)
    }
  }
  const isAuthenticated = user !== null
  context.locals.isAuthenticated = isAuthenticated
  context.locals.userId = user?.id ?? null
  context.locals.user = user

  if (
    !isAuthenticated &&
    !isLoginPage &&
    !isRegisterPage &&
    !isVerifyEmailPage &&
    !isForgotPasswordPage &&
    !isResetPasswordPage &&
    !isPublicAuthApi &&
    !isHealthCheck &&
    !isDigestCronApi &&
    !isBookmarkOpenApi &&
    !isPublicRoutePath
  ) {
    // Preserve page navigations (e.g. /save?url=… from an iOS Shortcut) so
    // login lands back where the user was headed. API calls keep the plain
    // /login redirect — they carry no navigable session to return to.
    if (context.request.method === "GET" && !pathname.startsWith("/api/")) {
      const next = `${pathname}${context.url.search}`
      return context.redirect(`/login?next=${encodeURIComponent(next)}`)
    }
    return context.redirect("/login")
  }

  if (
    isAuthenticated &&
    (isAdminPage || isAdminApi) &&
    user?.role !== "admin"
  ) {
    return context.redirect("/")
  }

  if (isAuthenticated && (isLoginPage || isRegisterPage)) {
    // Already signed in (e.g. opened /login?next=/save… on a logged-in
    // device): go to the requested page instead of the dashboard.
    const next = resolveNextPath(context.url.searchParams.get("next"), "/")
    return context.redirect(next)
  }

  const response = await next()
  if (pathname.startsWith("/api/")) {
    const corsHeaders = buildCorsHeaders(context.request)
    if (corsHeaders) {
      for (const [name, value] of Object.entries(corsHeaders)) {
        response.headers.set(name, value)
      }
    }
  }
  return response
})
