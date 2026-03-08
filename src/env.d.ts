/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly DATABASE_URL: string
  readonly HARBOR_USER: string
  readonly HARBOR_PASSWORD: string
  readonly SESSION_SECRET?: string
}

declare namespace App {
  interface Locals {
    isAuthenticated: boolean
  }
}
