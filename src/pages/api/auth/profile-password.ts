import type { APIRoute } from "astro"

import { getSessionCookieName, updateProfilePassword } from "@/lib/auth"

export const POST: APIRoute = async ({
  request,
  redirect,
  locals,
  cookies,
}) => {
  if (!locals.userId) {
    return redirect("/login")
  }

  const form = await request.formData()
  const currentPassword = String(form.get("currentPassword") ?? "")
  const nextPassword = String(form.get("nextPassword") ?? "")

  const updated = await updateProfilePassword(
    locals.userId,
    currentPassword,
    nextPassword
  )

  if ("error" in updated && updated.error) {
    return redirect(`/profile?error=${encodeURIComponent(updated.error)}`)
  }

  cookies.delete(getSessionCookieName(), { path: "/" })
  return redirect("/login?error=password_changed")
}
