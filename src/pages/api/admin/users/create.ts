import type { APIRoute } from "astro"

import { createUser } from "@/lib/auth"

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!locals.user || locals.user.role !== "admin") {
    return redirect("/")
  }

  const form = await request.formData()
  const name = String(form.get("name") ?? "")
  const email = String(form.get("email") ?? "")
  const password = String(form.get("password") ?? "")
  const roleValue = String(form.get("role") ?? "user")
  const role = roleValue === "admin" ? "admin" : "user"

  const created = await createUser({
    email,
    password,
    displayName: name,
    role,
    markVerified: true,
    isActive: true,
  })

  if (created.error) {
    return redirect(`/admin/users?error=${encodeURIComponent(created.error)}`)
  }

  return redirect("/admin/users?status=created")
}
