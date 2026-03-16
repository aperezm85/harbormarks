import type { APIRoute } from "astro"

import { getSessionCookieName, revokeSession } from "@/lib/auth"

export const GET: APIRoute = async ({ cookies, redirect }) => {
  const sessionToken = cookies.get(getSessionCookieName())?.value
  await revokeSession(sessionToken)
  cookies.delete(getSessionCookieName(), { path: "/" })
  return redirect("/login")
}

export const POST: APIRoute = async ({ cookies, redirect }) => {
  const sessionToken = cookies.get(getSessionCookieName())?.value
  await revokeSession(sessionToken)
  cookies.delete(getSessionCookieName(), { path: "/" })
  return redirect("/login")
}
