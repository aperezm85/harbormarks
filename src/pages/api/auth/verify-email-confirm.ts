import type { APIRoute } from "astro"

import { verifyEmailByToken } from "@/lib/auth"

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

  const verified = await verifyEmailByToken(token)

  if (wantsJson) {
    if (!verified) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 400,
          headers: {
            "content-type": "application/json",
          },
        }
      )
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  if (!verified) {
    return redirect("/verify-email?error=invalid_token")
  }

  return redirect("/login?error=email_verified")
}
