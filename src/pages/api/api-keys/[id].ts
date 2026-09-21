import type { APIRoute } from "astro"

import { parseBearerToken, revokeApiKey } from "@/lib/api-key"

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })
}

export const DELETE: APIRoute = async ({ locals, request, params }) => {
  if (
    !locals.userId ||
    parseBearerToken(request.headers.get("authorization")) !== null
  ) {
    return json({ error: "Unauthorized" }, 401)
  }

  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return json({ error: "Invalid key id" }, 400)
  }

  const revoked = await revokeApiKey(locals.userId, id)
  if (!revoked) {
    return json({ error: "API key not found" }, 404)
  }
  return json({ data: { ok: true } })
}
