/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly DATABASE_URL: string
  readonly HARBOR_USER?: string
  readonly HARBOR_PASSWORD?: string
  readonly HARBOR_BOOTSTRAP_ADMIN_EMAIL?: string
  readonly HARBOR_BOOTSTRAP_ADMIN_PASSWORD?: string
  readonly HARBOR_BOOTSTRAP_ADMIN_NAME?: string
  readonly HARBOR_ALLOW_SIGNUP?: string
  readonly HARBOR_REQUIRE_EMAIL_VERIFICATION?: string
}

declare namespace App {
  interface Locals {
    isAuthenticated: boolean
    userId: number | null
    user: {
      id: number
      email: string
      displayName: string | null
      avatarUrl: string
      role: "admin" | "user"
      isActive: boolean
      emailVerifiedAt: string | null
    } | null
  }
}
