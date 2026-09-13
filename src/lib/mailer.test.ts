import { afterEach, describe, expect, it } from "vitest"

import { isMailerConfigured, resolveAppBaseUrl } from "./mailer"

// Config-only tests: no SMTP connection is opened here.

describe("isMailerConfigured", () => {
  afterEach(() => {
    delete process.env.HARBOR_SMTP_HOST
    delete process.env.HARBOR_SMTP_FROM
  })

  it("is false without host and from", () => {
    delete process.env.HARBOR_SMTP_HOST
    delete process.env.HARBOR_SMTP_FROM
    expect(isMailerConfigured()).toBe(false)
  })

  it("is true once host and from are set", () => {
    process.env.HARBOR_SMTP_HOST = "mail.example.com"
    process.env.HARBOR_SMTP_FROM = "HarborMarks <marks@example.com>"
    expect(isMailerConfigured()).toBe(true)
  })
})

describe("resolveAppBaseUrl", () => {
  afterEach(() => {
    delete process.env.HARBOR_APP_BASE_URL
  })

  it("prefers HARBOR_APP_BASE_URL and strips trailing slashes", () => {
    process.env.HARBOR_APP_BASE_URL = "https://marks.example.com/"
    expect(resolveAppBaseUrl("http://internal:3000/x")).toBe(
      "https://marks.example.com"
    )
  })

  it("falls back to the request host behind no override", () => {
    delete process.env.HARBOR_APP_BASE_URL
    expect(resolveAppBaseUrl("http://internal:3000/reset-password?token=1")).toBe(
      "http://internal:3000"
    )
  })
})
