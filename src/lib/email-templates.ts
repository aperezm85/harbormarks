// Email HTML templates for HarborMarks.
//
// Layouts follow the emailcn.run registry blocks (https://www.emailcn.run,
// installed via `npx shadcn add @emailcn/...`), vendored here as dependency-free
// builders so the Docker image does not need a React Email pipeline:
// - weekly digest  -> `block-newsletter-default` (NewsletterDefault:
//   logo header, title hero, articles[{title, description, imageUrl, href}],
//   CTA button, footer)
// - reset/verify   -> `block-auth-otp-default` (AuthOtpDefault: logo header,
//   single-action card with magicLink button + expiry note + footer)
// To switch theme or restyle, edit these builders in place; the structure maps
// 1:1 to the emailcn block props.

export type DigestArticle = {
  title: string
  url: string
  // href is where the title links to: normally a signed tracking URL that
  // records the click (unread -> reading) before redirecting, while `url`
  // stays the human-readable address shown underneath.
  href: string
  description: string | null
  note: string | null
  tags: string[]
  savedAt: string
}

export function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function shell(opts: {
  preheader: string
  productName: string
  body: string
}): string {
  // Brand mark is pure HTML/CSS on purpose: external <img> logos break when
  // the app URL is not publicly reachable (localhost, LAN, VPN), because
  // inbox image proxies (e.g. Gmail's googleusercontent proxy) cannot fetch
  // them. A styled letter-mark renders everywhere, offline included.
  const mark = `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td width="28" height="28" style="width:28px;height:28px;border-radius:6px;background-color:#00598a;font-family:Inter,Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-align:center;vertical-align:middle;">H</td>
<td style="padding-left:10px;font-size:15px;font-weight:700;color:#18181b;">${escapeEmailHtml(opts.productName)}</td>
</tr></table>`
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeEmailHtml(opts.preheader)}</title></head><body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Inter,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeEmailHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
<tr><td style="padding:20px 24px;border-bottom:1px solid #f4f4f5;">
${mark}
</td></tr>
<tr><td style="padding:24px;">${opts.body}</td></tr>
<tr><td style="padding:16px 24px 24px;color:#71717a;font-size:12px;line-height:18px;border-top:1px solid #f4f4f5;">
You are receiving this because you enabled email notifications in ${escapeEmailHtml(opts.productName)}. Manage them from your profile page.
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

function actionButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr><td style="border-radius:8px;background-color:#18181b;">
<a href="${href}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">${escapeEmailHtml(label)}</a>
</td></tr></table>`
}

export function buildDigestEmail(opts: {
  displayName: string | null
  scopeLabel: string
  articles: DigestArticle[]
  dashboardUrl: string
  productName?: string
}): { subject: string; html: string; text: string } {
  const productName = opts.productName ?? "HarborMarks"
  const count = opts.articles.length
  const greeting = opts.displayName ? `Hi ${opts.displayName},` : "Hi,"
  const subject = `${productName} weekly digest (${count} ${count === 1 ? "link" : "links"})`
  const preheader = `${count} ${count === 1 ? "link" : "links"} waiting for you — ${opts.scopeLabel}.`

  const rows = opts.articles
    .map((article) => {
      const tags =
        article.tags.length > 0
          ? `<div style="margin-top:6px;font-size:12px;color:#71717a;">${article.tags.map((tag) => `#${escapeEmailHtml(tag)}`).join(" ")}</div>`
          : ""
      const note = article.note
        ? `<div style="margin-top:8px;padding:8px 12px;background-color:#f4f4f5;border-left:3px solid #00598a;border-radius:0 6px 6px 0;font-size:13px;line-height:20px;color:#3f3f46;"><span style="font-weight:600;">Your note: </span>${escapeEmailHtml(article.note)}</div>`
        : ""
      return `<tr><td style="padding:14px 0;border-bottom:1px solid #f4f4f5;">
<a href="${escapeEmailHtml(article.href)}" style="font-size:15px;font-weight:600;color:#18181b;text-decoration:none;">${escapeEmailHtml(article.title)}</a>
${article.description ? `<div style="margin-top:6px;font-size:13px;line-height:20px;color:#52525b;">${escapeEmailHtml(article.description)}</div>` : ""}
${note}
${tags}
<div style="margin-top:6px;font-size:12px;color:#a1a1aa;">Saved ${escapeEmailHtml(article.savedAt)}</div>
</td></tr>`
    })
    .join("")

  const body = `<h1 style="margin:0 0 4px;font-size:22px;line-height:30px;color:#18181b;">Your weekly digest</h1>
<p style="margin:0 0 4px;font-size:14px;color:#52525b;">${escapeEmailHtml(greeting)} here are your links for <strong>${escapeEmailHtml(opts.scopeLabel)}</strong>.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
${actionButton("Open HarborMarks", opts.dashboardUrl)}
<p style="font-size:12px;color:#a1a1aa;">Links open directly on the saved page. Change the digest scope or turn it off anytime from your profile.</p>`

  const textLines = [
    `${greeting} here are your links for ${opts.scopeLabel}:`,
    "",
    ...opts.articles.flatMap((article) => [
      `- ${article.title}`,
      `  ${article.href}`,
      ...(article.description ? [`  ${article.description}`] : []),
      ...(article.note ? [`  Your note: ${article.note}`] : []),
      ...(article.tags.length > 0 ? [`  Tags: ${article.tags.join(", ")}`] : []),
      `  Saved ${article.savedAt}`,
      "",
    ]),
    `Open ${productName}: ${opts.dashboardUrl}`,
  ]

  return {
    subject,
    html: shell({
      preheader,
      productName,
      body,
    }),
    text: textLines.join("\n"),
  }
}

export function buildAuthLinkEmail(opts: {
  kind: "reset" | "verify"
  actionUrl: string
  expiresNote: string
  recipientEmail?: string
  productName?: string
}): { subject: string; html: string; text: string } {
  const productName = opts.productName ?? "HarborMarks"
  const isReset = opts.kind === "reset"
  const subject = isReset
    ? `Reset your ${productName} password`
    : `Verify your ${productName} email`
  const heading = isReset ? "Reset your password" : "Verify your email"
  const intro = isReset
    ? "Someone requested a password reset for this email address. If that was you, use the button below."
    : "Thanks for signing up. Confirm this email address to finish setting up your account."
  const preheader = subject
  const recipient = opts.recipientEmail
    ? `<p style="font-size:13px;color:#52525b;">This email was sent to ${escapeEmailHtml(opts.recipientEmail)}.</p>`
    : ""

  const body = `<h1 style="margin:0 0 8px;font-size:22px;line-height:30px;color:#18181b;">${heading}</h1>
<p style="margin:0;font-size:14px;line-height:22px;color:#52525b;">${intro}</p>
${recipient}
${actionButton(isReset ? "Set a new password" : "Verify email address", opts.actionUrl)}
<p style="font-size:13px;line-height:20px;color:#52525b;">${escapeEmailHtml(opts.expiresNote)}</p>
<p style="font-size:13px;line-height:20px;color:#52525b;">If the button does not work, copy and paste this link into your browser:</p>
<p style="font-size:12px;line-height:18px;color:#3f3f46;word-break:break-all;">${escapeEmailHtml(opts.actionUrl)}</p>
<p style="font-size:13px;line-height:20px;color:#a1a1aa;">If you did not request this, you can safely ignore this email.</p>`

  const text = [
    heading,
    "",
    intro,
    ...(opts.recipientEmail ? [`This email was sent to ${opts.recipientEmail}.`] : []),
    "",
    opts.actionUrl,
    "",
    opts.expiresNote,
    "If you did not request this, you can safely ignore this email.",
  ].join("\n")

  return {
    subject,
    html: shell({
      preheader,
      productName,
      body,
    }),
    text,
  }
}
