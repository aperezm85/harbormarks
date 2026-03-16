import { defineMiddleware } from "astro:middleware"

import { getSessionCookieName, getUserBySessionToken } from "@/lib/auth"

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url

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
    !isPublicAuthApi
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
