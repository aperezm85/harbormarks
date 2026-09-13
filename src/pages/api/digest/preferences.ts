import type { APIRoute } from "astro"

import {
  getDigestPreference,
  isDigestScope,
  setDigestPreference,
} from "@/lib/digest"

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })
}

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user
  if (!user) {
    return json({ error: "Unauthorized" }, 401)
  }
  return json({ data: await getDigestPreference(user.id) })
}

export const PUT: APIRoute = async ({ locals, request }) => {
  const user = locals.user
  if (!user) {
    return json({ error: "Unauthorized" }, 401)
  }
  let body: { enabled?: unknown; scope?: unknown }
  try {
    body = (await request.json()) as { enabled?: unknown; scope?: unknown }
  } catch {
    return json({ error: "Invalid JSON body" }, 400)
  }
  if (body.scope !== undefined && !isDigestScope(body.scope)) {
    return json(
      { error: "Invalid scope (expected unread_7d, all_unread, or all_7d)" },
      400
    )
  }
  if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
    return json({ error: "Invalid enabled flag" }, 400)
  }
  try {
    const data = await setDigestPreference(user.id, {
      enabled:
        typeof body.enabled === "boolean" ? body.enabled : undefined,
      scope: body.scope,
    })
    return json({ data })
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Could not save" },
      400
    )
  }
}
