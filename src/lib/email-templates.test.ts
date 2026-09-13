import { describe, expect, it } from "vitest"

import {
  buildAuthLinkEmail,
  buildDigestEmail,
  escapeEmailHtml,
} from "./email-templates"

describe("escapeEmailHtml", () => {
  it("escapes tag delimiters, quotes, and ampersands", () => {
    expect(escapeEmailHtml(`<a href="x">&'`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;"
    )
  })
})

describe("buildDigestEmail", () => {
  it("lists every article and escapes hostile titles", () => {
    const email = buildDigestEmail({
      displayName: "Ada",
      scopeLabel: "unread links from the last 7 days",
      articles: [
        {
          title: `<script>alert("x")</script>`,
          url: "https://example.com/a",
          href: "https://marks.example.com/api/bookmarks/1/open?sig=abc",
          description: "Nice post",
          note: "My <b>take</b>",
          tags: ["rust"],
          savedAt: "2026-09-10",
        },
        {
          title: "Second",
          url: "https://example.com/b",
          href: "https://example.com/b",
          description: null,
          note: null,
          tags: [],
          savedAt: "2026-09-11",
        },
      ],
      dashboardUrl: "https://marks.example.com/?view=unread",
    })
    expect(email.subject).toContain("2 links")
    expect(email.html).toContain("https://marks.example.com/api/bookmarks/1/open?sig=abc")
    expect(email.html).toContain("https://example.com/b")
    expect(email.html).not.toContain("https://example.com/a")
    expect(email.html).not.toContain("<script>")
    expect(email.html).not.toContain("<img")
    expect(email.html).not.toContain("<b>take</b>")
    expect(email.html).toContain("Your note:")
    expect(email.html).toContain("#rust")
    expect(email.text).toContain("https://marks.example.com/api/bookmarks/1/open?sig=abc")
    expect(email.text).toContain("Open HarborMarks")
  })
})

describe("buildAuthLinkEmail", () => {
  it("embeds the action URL in both html and text, with expiry", () => {
    for (const kind of ["reset", "verify"] as const) {
      const email = buildAuthLinkEmail({
        kind,
        actionUrl: "https://marks.example.com/reset-password?token=abc",
        expiresNote: "This link expires soon.",
        recipientEmail: "ada@example.com",
      })
      expect(email.html).toContain(
        "https://marks.example.com/reset-password?token=abc"
      )
      expect(email.text).toContain(
        "https://marks.example.com/reset-password?token=abc"
      )
      expect(email.html).toContain("This link expires soon.")
      expect(email.subject.length).toBeGreaterThan(0)
    }
  })

  it("never renders an unescaped recipient", () => {
    const email = buildAuthLinkEmail({
      kind: "reset",
      actionUrl: "https://marks.example.com/x",
      expiresNote: "note",
      recipientEmail: `<b>ada</b>@example.com`,
    })
    expect(email.html).not.toContain("<b>ada</b>")
  })
})
