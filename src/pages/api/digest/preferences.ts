import type { APIRoute } from "astro"

import {
  getDigestPreference,
  isDigestDay,
  isDigestScope,
  isDigestTime,
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
  let body: { enabled?: unknown; scope?: unknown; sendDay?: unknown; sendTime?: unknown }
  try {
    body = (await request.json()) as { enabled?: unknown; scope?: unknown; sendDay?: unknown; sendTime?: unknown }
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
  if (body.sendDay !== undefined && !isDigestDay(body.sendDay)) {
    return json(
      { error: "Invalid send day (expected 0-6, Sunday-Saturday)" },
      400
    )
  }
  if (body.sendTime !== undefined && !isDigestTime(body.sendTime)) {
    return json(
      { error: "Invalid send time (expected HH:MM, 00:00-23:59)" },
      400
    )
  }
  try {
    const data = await setDigestPreference(user.id, {
      enabled:
        typeof body.enabled === "boolean" ? body.enabled : undefined,
      scope: body.scope,
      sendDay: body.sendDay,
      sendTime: body.sendTime,
    })
    return json({ data })
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Could not save" },
      400
    )
  }
}
