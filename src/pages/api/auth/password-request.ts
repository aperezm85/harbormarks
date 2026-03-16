import type { APIRoute } from "astro"

import { requestPasswordReset } from "@/lib/auth"

function isJsonRequest(contentType: string | null) {
  return contentType?.includes("application/json") === true
}

export const POST: APIRoute = async ({ request, redirect }) => {
  const wantsJson = isJsonRequest(request.headers.get("content-type"))
  const bodyValues = wantsJson ? await request.json() : await request.formData()

  const email = wantsJson
    ? typeof bodyValues?.email === "string"
      ? bodyValues.email
      : ""
    : String(bodyValues.get("email") ?? "")

  await requestPasswordReset(email, request.url)

  if (wantsJson) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    })
  }

  return redirect("/forgot-password?status=sent")
}
