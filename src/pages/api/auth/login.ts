import type { APIRoute } from "astro"

export const GET: APIRoute = async ({ redirect }) => {
  return redirect("/login")
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData()
  const username = form.get("username")
  const password = form.get("password")

  const USER = import.meta.env.HARBOR_USER
  const PASS = import.meta.env.HARBOR_PASSWORD

  console.log("[auth] Login attempt", {
    username,
    userConfigured: Boolean(USER),
    passConfigured: Boolean(PASS),
  })

  if (username === USER && password === PASS) {
    cookies.set("session", "authenticated", {
      path: "/",
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    })

    return redirect("/")
  }

  console.log("[auth] Invalid credentials")
  return redirect("/login?error=1")
}
