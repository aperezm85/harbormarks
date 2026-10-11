import type { APIRoute } from "astro"

import { checkLinkHealthBatch } from "@/lib/link-health-check"
import { rateLimitRequest } from "@/lib/request-security"

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })
}

// On-demand link-health scan. Runs one batch immediately (ignoring the
// daily-scheduler hour gate) so users can re-verify `is:broken` links right
// after a false positive without waiting for the next tick.
export const POST: APIRoute = async ({ locals }) => {
  const user = locals.user
  if (!user) {
    return json({ error: "Unauthorized" }, 401)
  }
  const rateLimit = rateLimitRequest(`link-health:check-now:user:${user.id}`, {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.allowed) {
    return json(
      {
        error: "Rate limited. Try again later.",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      429
    )
  }
  const result = await checkLinkHealthBatch()
  return json({ data: result })
}
