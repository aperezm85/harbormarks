import type { APIRoute } from "astro"

/**
 * Lightweight liveness probe for Docker / reverse proxies / monitoring.
 * Must stay unauthenticated (see src/middleware.ts allowlist) and must not
 * touch the database, so a failing DB does not mask a running process.
 * Use `/api/bookmarks` or login flow for readiness checks that need the DB.
 */
export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}
