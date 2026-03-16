import type { APIRoute } from "astro"

import { getMinPasswordLength, resetPasswordByToken } from "@/lib/auth"

function isJsonRequest(contentType: string | null) {
  return contentType?.includes("application/json") === true
}

export const POST: APIRoute = async ({ request, redirect }) => {
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
