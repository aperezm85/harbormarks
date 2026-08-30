import type { APIRoute } from "astro"

import { requestEmailVerification } from "@/lib/auth"
import { getRequestClientIp, rateLimitRequest } from "@/lib/request-security"

function isJsonRequest(contentType: string | null) {
  return contentType?.includes("application/json") === true
}

export const POST: APIRoute = async ({ request, redirect }) => {
  const clientIp = getRequestClientIp(request)
  const rateLimit = rateLimitRequest(
    `auth:verify-email-request:ip:${clientIp}`,
    {
      limit: 4,
      windowMs: 15 * 60 * 1000,
    }
  )

  if (!rateLimit.allowed) {
    return redirect("/verify-email?error=rate_limited")
  }

  const wantsJson = isJsonRequest(request.headers.get("content-type"))
  const bodyValues = wantsJson ? await request.json() : await request.formData()

  const email = wantsJson
    ? typeof bodyValues?.email === "string"
      ? bodyValues.email
      : ""
    : String(bodyValues.get("email") ?? "")

  await requestEmailVerification(email, request.url)

  if (wantsJson) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  return redirect("/verify-email?status=sent")
}
