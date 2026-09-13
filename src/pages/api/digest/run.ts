import type { APIRoute } from "astro"

import { runWeeklyDigest } from "@/lib/digest"
import { getRequestClientIp, rateLimitRequest } from "@/lib/request-security"

function readCronSecret(): string {
  return (
    process.env.HARBOR_CRON_SECRET ??
    (import.meta.env?.HARBOR_CRON_SECRET as string | undefined) ??
    ""
  ).trim()
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })
}

// Operator endpoint for external schedulers (host cron, Uptime Kuma, NAS task
// runner). Authenticated by shared secret, not by session cookie, so it is
// allowlisted in src/middleware.ts alongside /api/healthz.
export const POST: APIRoute = async ({ request }) => {
  const secret = readCronSecret()
  if (!secret) {
    return json(
      { error: "Digest cron is not configured (HARBOR_CRON_SECRET)." },
      503
    )
  }
  const provided =
    request.headers.get("x-cron-secret")?.trim() ||
    new URL(request.url).searchParams.get("secret")?.trim() ||
    ""
  const rateLimit = rateLimitRequest(
    `digest:run:ip:${getRequestClientIp(request)}`,
    { limit: 6, windowMs: 60 * 60 * 1000 }
  )
  if (!rateLimit.allowed) {
    return json({ error: "Rate limited. Try again later." }, 429)
  }
  if (!provided || provided !== secret) {
    return json({ error: "Unauthorized" }, 401)
  }
  const result = await runWeeklyDigest({ baseUrl: request.url })
  return json({ data: result })
}
