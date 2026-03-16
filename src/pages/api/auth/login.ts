import type { APIRoute } from "astro"

import {
  authenticateUser,
  createSessionForUser,
  getSessionCookieMaxAge,
  getSessionCookieName,
} from "@/lib/auth"

export const GET: APIRoute = async ({ redirect }) => {
  return redirect("/login")
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData()
  const username = String(form.get("username") ?? "")
  const password = String(form.get("password") ?? "")
  const isHttps = new URL(request.url).protocol === "https:"

  const user = await authenticateUser(username, password)

  if ("data" in user) {
    const sessionToken = await createSessionForUser(user.data.id)

    cookies.set(getSessionCookieName(), sessionToken, {
      path: "/",
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      maxAge: getSessionCookieMaxAge(),
    })

    return redirect("/")
  }

  return redirect(`/login?error=${encodeURIComponent(user.error)}`)
}
