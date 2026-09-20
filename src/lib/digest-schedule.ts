// Pure per-user digest schedule helpers. DB-free on purpose so the scheduling
// rules stay unit-testable without Postgres (anything touching the database
// lives in ./digest.ts, which re-exports these).

export const DIGEST_DEFAULT_DAY = 0
export const DIGEST_DEFAULT_TIME = "07:00"

export function normalizeDigestDay(value: unknown): number {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : value
  if (typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 6) {
    return n
  }
  return DIGEST_DEFAULT_DAY
}

export function isDigestDay(value: unknown): boolean {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : value
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 6
}

export function normalizeDigestTime(value: unknown): string {
  if (typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim())) {
    return value.trim()
  }
  return DIGEST_DEFAULT_TIME
}

export function isDigestTime(value: unknown): boolean {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim())
}

export function digestTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function startOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

// Per-user due check: same weekday, current time at/past the user's sendTime,
// and nothing auto-sent today yet. The "already sent today" guard prevents
// doubles; the generous same-day window provides catch-up after restarts.
export function isDigestDueForSchedule(
  now: Date,
  sendDay: number,
  sendTime: string,
  lastSentAt: Date | string | null
): boolean {
  if (now.getDay() !== normalizeDigestDay(sendDay)) return false
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  if (nowMinutes < digestTimeToMinutes(normalizeDigestTime(sendTime))) return false
  if (!lastSentAt) return true
  const last = lastSentAt instanceof Date ? lastSentAt : new Date(lastSentAt)
  if (Number.isNaN(last.getTime())) return true
  return last < startOfDay(now)
}
