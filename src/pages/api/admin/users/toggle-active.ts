import type { APIRoute } from "astro"

import { setUserActiveStatusByAdmin } from "@/lib/auth"

function parseUserId(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? ""))
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!locals.user || locals.user.role !== "admin") {
    return redirect("/")
  }

  const form = await request.formData()
  const userId = parseUserId(form.get("userId"))
  const isActive = String(form.get("isActive") ?? "false") === "true"

  if (!userId) {
    return redirect("/admin/users?error=Invalid user id")
  }

  const result = await setUserActiveStatusByAdmin(locals.user, userId, isActive)

  if ("error" in result && result.error) {
    return redirect(`/admin/users?error=${encodeURIComponent(result.error)}`)
  }

  return redirect("/admin/users?status=updated")
}
