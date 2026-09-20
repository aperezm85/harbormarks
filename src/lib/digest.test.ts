import { describe, expect, it } from "vitest"

import {
  DIGEST_DEFAULT_DAY,
  DIGEST_DEFAULT_TIME,
  digestTimeToMinutes,
  isDigestDay,
  isDigestDueForSchedule,
  isDigestTime,
  normalizeDigestDay,
  normalizeDigestTime,
} from "./digest-schedule"
import {
  DIGEST_SCOPE_LABELS,
  DIGEST_SCOPES,
  isDigestScope,
  toDigestArticles,
  type DigestBookmark,
} from "./digest-scope"

// Pure helpers only: anything touching Postgres lives behind
// ensureAuthSchema() and is covered by manual testing instead.

describe("isDigestScope", () => {
  it("accepts the three supported scopes", () => {
    expect(DIGEST_SCOPES).toHaveLength(3)
    for (const scope of ["unread_7d", "all_unread", "all_7d"]) {
      expect(isDigestScope(scope)).toBe(true)
    }
  })

  it("rejects anything else, including the empty string", () => {
    for (const value of ["", "weekly", "UNREAD_7D", null, undefined, 42]) {
      expect(isDigestScope(value)).toBe(false)
    }
  })

  it("labels every scope", () => {
    for (const scope of DIGEST_SCOPES) {
      expect(DIGEST_SCOPE_LABELS[scope].length).toBeGreaterThan(0)
    }
  })
})

describe("digest schedule helpers", () => {
  it("normalizes the send day, defaulting to Sunday", () => {
    expect(normalizeDigestDay(0)).toBe(0)
    expect(normalizeDigestDay(6)).toBe(6)
    expect(normalizeDigestDay("3")).toBe(3)
    for (const value of [7, -1, 1.5, "sun", null, undefined, ""]) {
      expect(normalizeDigestDay(value)).toBe(DIGEST_DEFAULT_DAY)
    }
  })

  it("validates the send day", () => {
    for (const value of [0, 6, "0", "6"]) {
      expect(isDigestDay(value)).toBe(true)
    }
    for (const value of [7, -1, "sun", null, undefined, ""]) {
      expect(isDigestDay(value)).toBe(false)
    }
  })

  it("normalizes the send time, defaulting to 07:00", () => {
    expect(normalizeDigestTime("09:45")).toBe("09:45")
    expect(normalizeDigestTime("00:00")).toBe("00:00")
    expect(normalizeDigestTime("23:59")).toBe("23:59")
    for (const value of ["24:00", "9:45", "09:60", "nope", "", null, undefined, 42]) {
      expect(normalizeDigestTime(value)).toBe(DIGEST_DEFAULT_TIME)
    }
  })

  it("validates the send time", () => {
    expect(isDigestTime("09:45")).toBe(true)
    expect(isDigestTime("24:00")).toBe(false)
    expect(isDigestTime("")).toBe(false)
  })

  it("converts HH:MM to minutes", () => {
    expect(digestTimeToMinutes("00:00")).toBe(0)
    expect(digestTimeToMinutes("07:00")).toBe(420)
    expect(digestTimeToMinutes("23:59")).toBe(1439)
  })
})

describe("isDigestDueForSchedule", () => {
  // 2026-09-20 is a Sunday; the Date constructor uses server-local time,
  // matching the scheduler's own getDay()/getHours() comparisons.
  const sundayMorning = new Date(2026, 8, 20, 9, 50)

  it("fires on the right weekday once the send time has passed", () => {
    expect(isDigestDueForSchedule(sundayMorning, 0, "09:45", null)).toBe(true)
  })

  it("does not fire on another weekday", () => {
    expect(isDigestDueForSchedule(sundayMorning, 1, "09:45", null)).toBe(false)
  })

  it("does not fire before the send time", () => {
    expect(isDigestDueForSchedule(sundayMorning, 0, "09:51", null)).toBe(false)
  })

  it("does not fire twice on the same day", () => {
    const earlierToday = new Date(2026, 8, 20, 8, 31)
    expect(isDigestDueForSchedule(sundayMorning, 0, "09:45", earlierToday)).toBe(false)
  })

  it("fires again after a previous day's run", () => {
    const yesterday = new Date(2026, 8, 19, 9, 45)
    expect(isDigestDueForSchedule(sundayMorning, 0, "09:45", yesterday)).toBe(true)
  })

  it("treats an unreadable lastSentAt as never sent", () => {
    expect(isDigestDueForSchedule(sundayMorning, 0, "09:45", "not-a-date")).toBe(true)
  })

  it("falls back to 07:00 for an invalid send time", () => {
    const earlySunday = new Date(2026, 8, 20, 6, 59)
    expect(isDigestDueForSchedule(earlySunday, 0, "bogus", null)).toBe(false)
    const lateSunday = new Date(2026, 8, 20, 7, 0)
    expect(isDigestDueForSchedule(lateSunday, 0, "bogus", null)).toBe(true)
  })
})

describe("toDigestArticles", () => {
  it("falls back to the URL when the title is missing", () => {
    const rows: DigestBookmark[] = [
      {
        id: 1,
        url: "https://example.com/a",
        title: null,
        description: null,
        note: null,
        tags: null,
        createdAt: new Date("2026-09-01T10:00:00.000Z"),
      },
    ]
    const [article] = toDigestArticles(rows)
    expect(article.title).toBe("https://example.com/a")
    expect(article.description).toBeNull()
    expect(article.note).toBeNull()
    expect(article.tags).toEqual([])
    expect(article.savedAt).toBe("2026-09-01")
    expect(article.href).toBe("https://example.com/a")
  })

  it("drops blank tags and normalizes the saved date", () => {
    const rows: DigestBookmark[] = [
      {
        id: 2,
        url: "https://example.com/b",
        title: "  B  ",
        description: "  desc  ",
        note: "  read this  ",
        tags: ["rust", "  ", ""],
        createdAt: null,
      },
    ]
    const [article] = toDigestArticles(rows)
    expect(article.tags).toEqual(["rust"])
    expect(article.note).toBe("read this")
    expect(article.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
