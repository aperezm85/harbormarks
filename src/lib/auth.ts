import { and, eq, gt, isNull, sql } from "drizzle-orm"
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto"

import { db } from "@/db/client"
import {
  bookmarks,
  emailVerificationTokens,
  passwordResetTokens,
  sessions,
  users,
} from "@/db/schema"

const SESSION_COOKIE_NAME = "session"
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30
const MIN_PASSWORD_LENGTH = 8
const VERIFICATION_TOKEN_TTL_SECONDS = 60 * 60 * 24
const PASSWORD_RESET_TOKEN_TTL_SECONDS = 60 * 30

let isAuthSchemaReady = false
let bootstrapAttempted = false

export type AuthenticatedUser = {
  id: number
  email: string
  displayName: string | null
  avatarUrl: string
  role: "admin" | "user"
  isActive: boolean
  emailVerifiedAt: string | null
}

export type AdminUserSummary = {
  id: number
  email: string
  displayName: string | null
  avatarUrl: string
  role: "admin" | "user"
  isActive: boolean
  emailVerifiedAt: string | null
  createdAt: string
}

type AuthenticationFailure = "invalid_credentials" | "account_disabled"

type AuthenticationResult =
  | { data: AuthenticatedUser }
  | { error: AuthenticationFailure }

function parseRole(role: string): "admin" | "user" {
  return role === "admin" ? "admin" : "user"
}

function toAuthenticatedUser(user: {
  id: number
  email: string
  displayName: string | null
  avatarUrl: string | null
  role: string
  isActive: boolean
  emailVerifiedAt: Date | null
}): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? gravatarUrl(user.email),
    role: parseRole(user.role),
    isActive: user.isActive,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
  }
}

function expirationDate(ttlSeconds: number) {
  return new Date(Date.now() + ttlSeconds * 1000)
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function md5(value: string) {
  return createHash("md5").update(value).digest("hex")
}

function buildLocalAvatarDataUrl(seed: string, label: string) {
  const hash = md5(seed)
  const background = `#${hash.slice(0, 6)}`
  const foreground = "#ffffff"
  const glyph = (label.trim().slice(0, 1) || "U").toUpperCase()

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" role="img" aria-label="avatar"><rect width="96" height="96" rx="24" fill="${background}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="${foreground}" font-family="Inter,system-ui,sans-serif" font-size="44" font-weight="700">${glyph}</text></svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function resolveDisplayName(email: string, displayName: string | null) {
  if (displayName?.trim()) {
    return displayName.trim()
  }

  const [localPart] = email.split("@")
  return localPart || email
}

function gravatarUrl(email: string) {
  const normalizedEmail = normalizeEmail(email)
  const [localPart] = normalizedEmail.split("@")
  return buildLocalAvatarDataUrl(normalizedEmail, localPart || normalizedEmail)
}

function resolveAvatarUrl(email: string, avatarUrl?: string | null) {
  const candidate = avatarUrl?.trim()

  if (!candidate) {
    return gravatarUrl(email)
  }

  if (candidate.includes("gravatar.com/avatar/")) {
    return gravatarUrl(email)
  }

  return candidate
}

function hashPassword(password: string, salt?: string) {
  const passwordSalt = salt ?? randomBytes(16).toString("hex")
  const hash = scryptSync(password, passwordSalt, 64).toString("hex")
  return `${passwordSalt}:${hash}`
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedHash] = storedHash.split(":")

  if (!salt || !expectedHash) {
    return false
  }

  const computedHash = scryptSync(password, salt, 64).toString("hex")

  try {
    return timingSafeEqual(
      Buffer.from(expectedHash, "hex"),
      Buffer.from(computedHash, "hex")
    )
  } catch {
    return false
  }
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

function sessionExpiryDate() {
  return expirationDate(SESSION_TTL_SECONDS)
}

export function isEmailVerificationRequired() {
  return false
}

function hashActionToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

function makeActionToken() {
  const value = randomBytes(32).toString("hex")
  return {
    value,
    hash: hashActionToken(value),
  }
}

function createAbsoluteUrl(baseUrl: string, pathWithQuery: string) {
  const base = new URL(baseUrl)
  return new URL(pathWithQuery, `${base.protocol}//${base.host}`).toString()
}

async function maybeBootstrapAdminUser() {
  if (bootstrapAttempted) {
    return
  }

  bootstrapAttempted = true

  const emailSource =
    process.env.HARBOR_BOOTSTRAP_ADMIN_EMAIL ??
    process.env.HARBOR_USER ??
    import.meta.env.HARBOR_USER
  const passwordSource =
    process.env.HARBOR_BOOTSTRAP_ADMIN_PASSWORD ??
    process.env.HARBOR_PASSWORD ??
    import.meta.env.HARBOR_PASSWORD
  const nameSource =
    process.env.HARBOR_BOOTSTRAP_ADMIN_NAME ??
    import.meta.env.HARBOR_BOOTSTRAP_ADMIN_NAME

  const email =
    typeof emailSource === "string" ? normalizeEmail(emailSource) : ""
  const password = typeof passwordSource === "string" ? passwordSource : ""
  const adminName = typeof nameSource === "string" ? nameSource.trim() : ""

  if (!email || !password) {
    return
  }

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(users)

  if (count > 0) {
    return
  }

  const displayName = resolveDisplayName(email, adminName || null)
  await db.insert(users).values({
    email,
    displayName,
    avatarUrl: gravatarUrl(email),
    role: "admin",
    isActive: true,
    emailVerifiedAt: new Date(),
    passwordHash: hashPassword(password),
  })
}

async function backfillLegacyBookmarks() {
  const [owner] = await db.select({ id: users.id }).from(users).limit(1)

  if (!owner) {
    return
  }

  await db
    .update(bookmarks)
    .set({ userId: owner.id })
    .where(isNull(bookmarks.userId))
}

export async function ensureAuthSchema() {
  if (isAuthSchemaReady) {
    return
  }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      email_verified_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      revoked_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)

  await db.execute(sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  `)

  await db.execute(sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE
  `)

  await db.execute(sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP
  `)

  await db.execute(sql`
    ALTER TABLE bookmarks
    ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id)
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id)
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id)
  `)

  await maybeBootstrapAdminUser()
  await backfillLegacyBookmarks()

  isAuthSchemaReady = true
}

export async function createUser(input: {
  email: string
  password: string
  displayName: string
  role?: "admin" | "user"
  isActive?: boolean
  markVerified?: boolean
}) {
  await ensureAuthSchema()

  const email = normalizeEmail(input.email)
  const password = input.password

  if (!email) {
    return { error: "Email is required" as const }
  }

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return {
      error:
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters` as const,
    }
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (existing) {
    return { error: "Email is already registered" as const }
  }

  const trimmedDisplayName = input.displayName.trim()

  if (!trimmedDisplayName) {
    return { error: "Name is required" as const }
  }

  const displayName = resolveDisplayName(email, trimmedDisplayName)

  const [created] = await db
    .insert(users)
    .values({
      email,
      displayName,
      avatarUrl: gravatarUrl(email),
      role: input.role ?? "user",
      isActive: input.isActive ?? true,
      emailVerifiedAt: input.markVerified ? new Date() : null,
      passwordHash: hashPassword(password),
    })
    .returning({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      isActive: users.isActive,
      emailVerifiedAt: users.emailVerifiedAt,
    })

  return {
    data: toAuthenticatedUser(created),
  }
}

export async function authenticateUser(
  emailOrUsername: string,
  password: string
): Promise<AuthenticationResult> {
  await ensureAuthSchema()

  const email = normalizeEmail(emailOrUsername)

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      isActive: users.isActive,
      emailVerifiedAt: users.emailVerifiedAt,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (!user) {
    return { error: "invalid_credentials" }
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return { error: "invalid_credentials" }
  }

  if (!user.isActive) {
    return { error: "account_disabled" }
  }

  return { data: toAuthenticatedUser(user) }
}

export async function createSessionForUser(userId: number) {
  await ensureAuthSchema()

  const token = randomBytes(32).toString("hex")
  const tokenHash = hashSessionToken(token)

  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt: sessionExpiryDate(),
  })

  return token
}

export async function getUserBySessionToken(token: string | undefined | null) {
  await ensureAuthSchema()

  if (!token) {
    return null
  }

  const tokenHash = hashSessionToken(token)

  const [sessionUser] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      isActive: users.isActive,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        eq(users.isActive, true),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1)

  if (!sessionUser) {
    return null
  }

  return toAuthenticatedUser(sessionUser)
}

export async function revokeSession(token: string | undefined | null) {
  await ensureAuthSchema()

  if (!token) {
    return
  }

  const tokenHash = hashSessionToken(token)

  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
}

async function revokeAllSessionsByUserId(userId: number) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
}

export async function requestEmailVerification(
  emailInput: string,
  baseUrl: string
) {
  await ensureAuthSchema()

  const email = normalizeEmail(emailInput)
  if (!email) {
    return
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      emailVerifiedAt: users.emailVerifiedAt,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (!user || !user.isActive || user.emailVerifiedAt) {
    return
  }

  const token = makeActionToken()
  await db.insert(emailVerificationTokens).values({
    userId: user.id,
    tokenHash: token.hash,
    expiresAt: expirationDate(VERIFICATION_TOKEN_TTL_SECONDS),
  })

  const verificationUrl = createAbsoluteUrl(
    baseUrl,
    `/verify-email?token=${encodeURIComponent(token.value)}`
  )
  console.info(
    `[auth] Email verification link for ${user.email}: ${verificationUrl}`
  )
}

export async function verifyEmailByToken(rawToken: string) {
  await ensureAuthSchema()

  const tokenValue = rawToken.trim()
  if (!tokenValue) {
    return false
  }

  const tokenHash = hashActionToken(tokenValue)

  const [tokenRow] = await db
    .select({
      id: emailVerificationTokens.id,
      userId: emailVerificationTokens.userId,
    })
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.tokenHash, tokenHash),
        isNull(emailVerificationTokens.usedAt),
        gt(emailVerificationTokens.expiresAt, new Date())
      )
    )
    .limit(1)

  if (!tokenRow) {
    return false
  }

  await db
    .update(users)
    .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, tokenRow.userId))

  await db
    .update(emailVerificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(emailVerificationTokens.id, tokenRow.id))

  return true
}

export async function requestPasswordReset(
  emailInput: string,
  baseUrl: string
) {
  await ensureAuthSchema()

  const email = normalizeEmail(emailInput)
  if (!email) {
    return
  }

  const [user] = await db
    .select({ id: users.id, email: users.email, isActive: users.isActive })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (!user || !user.isActive) {
    return
  }

  const token = makeActionToken()
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: token.hash,
    expiresAt: expirationDate(PASSWORD_RESET_TOKEN_TTL_SECONDS),
  })

  const resetUrl = createAbsoluteUrl(
    baseUrl,
    `/reset-password?token=${encodeURIComponent(token.value)}`
  )
  console.info(`[auth] Password reset link for ${user.email}: ${resetUrl}`)
}

export async function resetPasswordByToken(
  rawToken: string,
  nextPassword: string
) {
  await ensureAuthSchema()

  if (!nextPassword || nextPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      error:
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters` as const,
    }
  }

  const tokenValue = rawToken.trim()
  if (!tokenValue) {
    return { error: "Invalid reset token" as const }
  }

  const tokenHash = hashActionToken(tokenValue)

  const [tokenRow] = await db
    .select({ id: passwordResetTokens.id, userId: passwordResetTokens.userId })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    )
    .limit(1)

  if (!tokenRow) {
    return { error: "Invalid or expired reset token" as const }
  }

  await db
    .update(users)
    .set({ passwordHash: hashPassword(nextPassword), updatedAt: new Date() })
    .where(eq(users.id, tokenRow.userId))

  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, tokenRow.id))

  await revokeAllSessionsByUserId(tokenRow.userId)

  return { ok: true as const }
}

export async function updateProfileName(userId: number, displayName: string) {
  await ensureAuthSchema()

  const trimmedName = displayName.trim()
  if (!trimmedName) {
    return { error: "Name is required" as const }
  }

  const [updated] = await db
    .update(users)
    .set({ displayName: trimmedName, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      isActive: users.isActive,
      emailVerifiedAt: users.emailVerifiedAt,
    })

  if (!updated) {
    return { error: "User not found" as const }
  }

  return { data: toAuthenticatedUser(updated) }
}

export async function updateProfilePassword(
  userId: number,
  currentPassword: string,
  nextPassword: string
) {
  await ensureAuthSchema()

  if (!nextPassword || nextPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      error:
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters` as const,
    }
  }

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    return { error: "Current password is incorrect" as const }
  }

  await db
    .update(users)
    .set({ passwordHash: hashPassword(nextPassword), updatedAt: new Date() })
    .where(eq(users.id, userId))

  await revokeAllSessionsByUserId(userId)

  return { ok: true as const }
}

export async function listUsersForAdmin(): Promise<AdminUserSummary[]> {
  await ensureAuthSchema()

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      isActive: users.isActive,
      emailVerifiedAt: users.emailVerifiedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.id)

  return rows.map(
    (row) =>
      ({
        id: row.id,
        email: row.email,
        displayName: row.displayName,
        avatarUrl: resolveAvatarUrl(row.email, row.avatarUrl),
        role: parseRole(row.role),
        isActive: row.isActive,
        emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
        createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      }) satisfies AdminUserSummary
  )
}

export async function setUserActiveStatusByAdmin(
  actor: AuthenticatedUser,
  targetUserId: number,
  isActive: boolean
) {
  await ensureAuthSchema()

  if (actor.role !== "admin") {
    return { error: "Unauthorized" as const }
  }

  if (actor.id === targetUserId && !isActive) {
    return { error: "You cannot disable your own account" as const }
  }

  const [updated] = await db
    .update(users)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(users.id, targetUserId))
    .returning({ id: users.id })

  if (!updated) {
    return { error: "User not found" as const }
  }

  if (!isActive) {
    await revokeAllSessionsByUserId(targetUserId)
  }

  return { ok: true as const }
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME
}

export function getSessionCookieMaxAge() {
  return SESSION_TTL_SECONDS
}

export function isSignupEnabled() {
  const rawValue =
    process.env.HARBOR_ALLOW_SIGNUP ?? import.meta.env.HARBOR_ALLOW_SIGNUP

  if (typeof rawValue !== "string") {
    return true
  }

  return rawValue.toLowerCase() !== "false"
}

export function getMinPasswordLength() {
  return MIN_PASSWORD_LENGTH
}
