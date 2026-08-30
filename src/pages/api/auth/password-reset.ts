import type { APIRoute } from "astro"

import { getMinPasswordLength, resetPasswordByToken } from "@/lib/auth"
import { getRequestClientIp, rateLimitRequest } from "@/lib/request-security"

function isJsonRequest(contentType: string | null) {
  return contentType?.includes("application/json") === true
}

export const POST: APIRoute = async ({ request, redirect }) => {
  const clientIp = getRequestClientIp(request)
  const rateLimit = rateLimitRequest(`auth:password-reset:ip:${clientIp}`, {
    limit: 6,
    windowMs: 15 * 60 * 1000,
  })

  if (!rateLimit.allowed) {
    return redirect("/reset-password?error=rate_limited")
  }

  const wantsJson = isJsonRequest(request.headers.get("content-type"))
  const bodyValues = wantsJson ? await request.json() : await request.formData()

  const token = wantsJson
    ? typeof bodyValues?.token === "string"
      ? bodyValues.token
      : ""
    : String(bodyValues.get("token") ?? "")
  const password = wantsJson
    ? typeof bodyValues?.password === "string"
      ? bodyValues.password
      : ""
    : String(bodyValues.get("password") ?? "")

  const result = await resetPasswordByToken(token, password)

  if ("error" in result && result.error) {
    if (wantsJson) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 400,
        headers: {
          "content-type": "application/json",
        },
      })
    }

    return redirect(
      `/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent(result.error)}`
    )
  }

  if (wantsJson) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  return redirect(
    `/login?error=password_reset_success&minPassword=${getMinPasswordLength()}`
  )
}
