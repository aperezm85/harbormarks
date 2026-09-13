import nodemailer, { type Transporter } from "nodemailer"

export type MailPayload = {
  to: string
  subject: string
  text: string
  html: string
}

function readEnv(name: string): string {
  const fromProcess =
    typeof process !== "undefined" ? process.env[name] : undefined
  if (typeof fromProcess === "string" && fromProcess.trim()) {
    return fromProcess.trim()
  }
  try {
    const fromImportMeta = (import.meta.env as Record<string, unknown>)[name]
    if (typeof fromImportMeta === "string" && fromImportMeta.trim()) {
      return fromImportMeta.trim()
    }
  } catch {
    // import.meta.env is unavailable in some runtimes; env-only config then.
  }
  return ""
}

export function isMailerConfigured(): boolean {
  return readEnv("HARBOR_SMTP_HOST") !== "" && readEnv("HARBOR_SMTP_FROM") !== ""
}

export function getMailerFrom(): string {
  return readEnv("HARBOR_SMTP_FROM") || "HarborMarks <noreply@localhost>"
}

// Absolute public base URL for links placed inside emails. HARBOR_APP_BASE_URL
// wins so links stay correct behind a reverse proxy (where request.url only
// sees the internal host); otherwise fall back to the incoming request URL.
export function resolveAppBaseUrl(requestUrl?: string): string {
  const configured = readEnv("HARBOR_APP_BASE_URL").replace(/\/+$/, "")
  if (configured) {
    return configured
  }
  if (requestUrl) {
    try {
      const parsed = new URL(requestUrl)
      return `${parsed.protocol}//${parsed.host}`
    } catch {
      // Fall through to localhost default below.
    }
  }
  return "http://localhost:3000"
}

let transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (transporter) {
    return transporter
  }
  const portRaw = readEnv("HARBOR_SMTP_PORT")
  const port = portRaw ? Number.parseInt(portRaw, 10) : 587
  const secureRaw = readEnv("HARBOR_SMTP_SECURE").toLowerCase()
  const user = readEnv("HARBOR_SMTP_USER")
  const pass = readEnv("HARBOR_SMTP_PASS")
  transporter = nodemailer.createTransport({
    host: readEnv("HARBOR_SMTP_HOST"),
    port: Number.isNaN(port) ? 587 : port,
    secure: secureRaw === "true" || (!secureRaw && port === 465),
    auth: user || pass ? { user, pass } : undefined,
  })
  return transporter
}

export function resetMailerForTests() {
  transporter = null
}

export async function sendMail(payload: MailPayload): Promise<void> {
  if (!isMailerConfigured()) {
    throw new Error("Email is not configured (HARBOR_SMTP_HOST/HARBOR_SMTP_FROM)")
  }
  await getTransporter().sendMail({
    from: getMailerFrom(),
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  })
}
