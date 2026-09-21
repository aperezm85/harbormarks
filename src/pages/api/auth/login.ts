import type { APIRoute } from "astro"

import {
  authenticateUser,
  createSessionForUser,
  getSessionCookieMaxAge,
  getSessionCookieName,
} from "@/lib/auth"
import {
  getRequestClientIp,
  isRequestSecure,
  rateLimitRequest,
} from "@/lib/request-security"
import { resolveNextPath } from "@/lib/safe-next"

export const GET: APIRoute = async ({ redirect }) => {
  return redirect("/login")
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData()
  const username = String(form.get("username") ?? "")
  const password = String(form.get("password") ?? "")
  // Return-to target (e.g. /save?url=… from an iOS Shortcut). Resolved to a
  // safe same-origin path; unsafe values fall back to "" (dropped below).
  const next = resolveNextPath(form.get("next"), "")
  const clientIp = getRequestClientIp(request)
  const accountKey = username.trim().toLowerCase() || "unknown"

  const ipLimit = rateLimitRequest(`auth:login:ip:${clientIp}`, {
    limit: 6,
    windowMs: 10 * 60 * 1000,
  })
  const accountLimit = rateLimitRequest(`auth:login:account:${accountKey}`, {
    limit: 6,
    windowMs: 10 * 60 * 1000,
  })

  if (!ipLimit.allowed || !accountLimit.allowed) {
    return redirect(
      next ? `/login?error=rate_limited&next=${encodeURIComponent(next)}` : "/login?error=rate_limited"
    )
  }

  const user = await authenticateUser(username, password)

  if ("data" in user) {
    const sessionToken = await createSessionForUser(user.data.id)

    cookies.set(getSessionCookieName(), sessionToken, {
      path: "/",
      httpOnly: true,
      secure: isRequestSecure(request),
      sameSite: "lax",
      maxAge: getSessionCookieMaxAge(),
    })

    return redirect(next || "/")
  }

  return redirect(
    next
      ? `/login?error=${encodeURIComponent(user.error)}&next=${encodeURIComponent(next)}`
      : `/login?error=${encodeURIComponent(user.error)}`
  )
}
