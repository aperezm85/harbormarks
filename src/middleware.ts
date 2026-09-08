import { defineMiddleware } from "astro:middleware"

import { getSessionCookieName, getUserBySessionToken } from "@/lib/auth"
import {
  createCrossOriginForbiddenResponse,
  isForbiddenCrossOriginRequest,
} from "@/lib/origin-check"

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url

  // Runs before anything else so an untrusted origin never reaches a handler.
  // Astro's built-in check is disabled in astro.config.mjs because it is baked
  // in at build time and cannot be configured on a published image.
  if (
    isForbiddenCrossOriginRequest(
      context.request,
      context.url,
      context.isPrerendered,
    )
  ) {
    return createCrossOriginForbiddenResponse(context.request)
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
  const isHealthCheck =
    pathname === "/api/healthz" || pathname === "/healthz"
  const isAdminPage = pathname.startsWith("/admin")
  const isAdminApi = pathname.startsWith("/api/admin/")

  const session = context.cookies.get(getSessionCookieName())?.value
  const user = await getUserBySessionToken(session)
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
    !isHealthCheck
  ) {
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
    return context.redirect("/")
  }

  return next()
})
