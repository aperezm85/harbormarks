import type { APIRoute } from "astro"

import { updateProfileName } from "@/lib/auth"

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!locals.userId) {
    return redirect("/login")
  }

  const form = await request.formData()
  const displayName = String(form.get("displayName") ?? "")

  const updated = await updateProfileName(locals.userId, displayName)

  if ("error" in updated && updated.error) {
    return redirect(`/profile?error=${encodeURIComponent(updated.error)}`)
  }

  return redirect("/profile?status=updated")
}
