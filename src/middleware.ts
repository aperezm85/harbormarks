import { defineMiddleware } from "astro:middleware"

export const onRequest = defineMiddleware((context, next) => {
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
  const isPublicAuthApi = pathname.startsWith("/api/auth/")

  const session = context.cookies.get("session")?.value
  const isAuthenticated = session === "authenticated"
  context.locals.isAuthenticated = isAuthenticated

  if (!isAuthenticated && !isLoginPage && !isPublicAuthApi) {
    return context.redirect("/login")
  }

  if (isAuthenticated && isLoginPage) {
    return context.redirect("/")
  }

  return next()
})
