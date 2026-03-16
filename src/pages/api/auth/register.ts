import type { APIRoute } from "astro"

import {
  createSessionForUser,
  createUser,
  getSessionCookieMaxAge,
  getSessionCookieName,
  isSignupEnabled,
} from "@/lib/auth"

function isJsonRequest(contentType: string | null) {
  return contentType?.includes("application/json") === true
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!isSignupEnabled()) {
    if (isJsonRequest(request.headers.get("content-type"))) {
      return new Response(JSON.stringify({ error: "Sign up is disabled" }), {
        status: 403,
        headers: {
          "content-type": "application/json",
        },
      })
    }

    return redirect("/register?error=signup_disabled")
  }

  const contentType = request.headers.get("content-type")
  const wantsJson = isJsonRequest(contentType)

  const bodyValues = wantsJson ? await request.json() : await request.formData()

  const email = wantsJson
    ? typeof bodyValues?.email === "string"
      ? bodyValues.email
      : ""
    : String(bodyValues.get("email") ?? "")
  const password = wantsJson
    ? typeof bodyValues?.password === "string"
      ? bodyValues.password
      : ""
    : String(bodyValues.get("password") ?? "")
  const displayName = wantsJson
    ? typeof bodyValues?.displayName === "string"
      ? bodyValues.displayName
      : ""
    : String(bodyValues.get("displayName") ?? "")

  const created = await createUser({
    email,
    password,
    displayName,
    role: "user",
    markVerified: true,
  })

  if (created.error) {
    if (wantsJson) {
      return new Response(JSON.stringify({ error: created.error }), {
        status: 400,
        headers: {
          "content-type": "application/json",
        },
      })
    }

    return redirect(`/register?error=${encodeURIComponent(created.error)}`)
  }

  const isHttps = new URL(request.url).protocol === "https:"
  const sessionToken = await createSessionForUser(created.data.id)

  cookies.set(getSessionCookieName(), sessionToken, {
    path: "/",
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    maxAge: getSessionCookieMaxAge(),
  })

  if (wantsJson) {
    return new Response(
      JSON.stringify({
        data: created.data,
        verificationRequired: false,
      }),
      {
        status: 201,
        headers: {
          "content-type": "application/json",
        },
      }
    )
  }

  return redirect("/")
}
