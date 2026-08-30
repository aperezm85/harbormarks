const rateLimitStore = new Map<
  string,
  {
    count: number
    resetAt: number
  }
>()

export function getRequestClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")
  const realIp = request.headers.get("x-real-ip")
  const connectingIp = request.headers.get("cf-connecting-ip")

  const candidate =
    forwardedFor?.split(",")[0]?.trim() ||
    realIp?.trim() ||
    connectingIp?.trim()

  return candidate || "unknown"
}

export function isRequestSecure(request: Request) {
  const explicitSetting = process.env.HARBOR_SECURE_COOKIES

  if (explicitSetting === "true") {
    return true
  }

  if (explicitSetting === "false") {
    return false
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")
  const firstProto = forwardedProto?.split(",")[0]?.trim().toLowerCase()

  return firstProto === "https" || request.url.startsWith("https://")
}

export function rateLimitRequest(
  key: string,
  options: { limit: number; windowMs: number }
) {
  const now = Date.now()
  const existing = rateLimitStore.get(key)

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + options.windowMs })
    return { allowed: true as const, retryAfterSeconds: 0 }
  }

  if (existing.count >= options.limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt - now) / 1000)
    )

    return { allowed: false as const, retryAfterSeconds }
  }

  existing.count += 1
  rateLimitStore.set(key, existing)

  return { allowed: true as const, retryAfterSeconds: 0 }
}
