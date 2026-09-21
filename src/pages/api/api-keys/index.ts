import type { APIRoute } from "astro"

import {
  createApiKey,
  listApiKeysByUser,
  parseBearerToken,
  validateKeyName,
} from "@/lib/api-key"
import { rateLimitRequest } from "@/lib/request-security"

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })
}

// Key management is session-only: a Bearer API key must never be able to
// list or mint further keys, otherwise a leaked extension/Shortcut key
// becomes a full account-takeover primitive.
function isBearerRequest(request: Request) {
  return parseBearerToken(request.headers.get("authorization")) !== null
}

export const GET: APIRoute = async ({ locals, request }) => {
  if (!locals.userId || isBearerRequest(request)) {
    return json({ error: "Unauthorized" }, 401)
  }
  return json({ data: await listApiKeysByUser(locals.userId) })
}

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.userId || isBearerRequest(request)) {
    return json({ error: "Unauthorized" }, 401)
  }

  const limited = rateLimitRequest(`apikeys:create:uid:${locals.userId}`, {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  })
  if (!limited.allowed) {
    return json({ error: "Rate limited. Try again later." }, 429)
  }

  let body: { name?: unknown }
  try {
    body = (await request.json()) as { name?: unknown }
  } catch {
    return json({ error: "Invalid JSON body" }, 400)
  }

  const name = validateKeyName(body.name)
  if (!name) {
    return json({ error: "Invalid name (1-64 characters)" }, 400)
  }

  const created = await createApiKey(locals.userId, name)
  // The raw key is returned exactly once; listing never includes it.
  return json({ data: created }, 201)
}
