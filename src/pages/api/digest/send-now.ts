import type { APIRoute } from "astro"

import { isDigestScope, sendDigestForUser } from "@/lib/digest"
import { isMailerConfigured } from "@/lib/mailer"
import { getRequestClientIp, rateLimitRequest } from "@/lib/request-security"

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })
}

export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.user
  if (!user) {
    return json({ error: "Unauthorized" }, 401)
  }
  const rateLimit = rateLimitRequest(`digest:send-now:user:${user.id}`, {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.allowed) {
    return json(
      { error: "Rate limited. Try again later.", retryAfterSeconds: rateLimit.retryAfterSeconds },
      429
    )
  }
  if (!isMailerConfigured()) {
    return json(
      { error: "Email is not configured by the administrator yet." },
      503
    )
  }
  let scopeOverride = undefined
  try {
    const body = (await request.json().catch(() => null)) as {
      scope?: unknown
    } | null
    if (body?.scope !== undefined) {
      if (!isDigestScope(body.scope)) {
        return json(
          { error: "Invalid scope (expected unread_7d, all_unread, or all_7d)" },
          400
        )
      }
      scopeOverride = body.scope
    }
  } catch {
    return json({ error: "Invalid JSON body" }, 400)
  }
  void getRequestClientIp(request)
  const result = await sendDigestForUser(user.id, {
    baseUrl: request.url,
    scopeOverride,
  })
  if (result.status === "sent") {
    return json({ data: { status: "sent", count: result.count } })
  }
  if (result.status === "empty") {
    return json({ data: { status: "empty", count: 0 } })
  }
  if (result.status === "disabled") {
    return json(
      { error: "Weekly digest is not enabled for your account." },
      400
    )
  }
  return json(
    { error: "Email is not configured by the administrator yet." },
    503
  )
}
