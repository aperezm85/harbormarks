import { Client } from "pg"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  deriveDatabaseUrl,
  dropTestDatabase,
  getControlUrl,
  runMigrations,
} from "../../test/support"

const controlUrl = getControlUrl()
const SUITE_DB = "harbor_test_apikey"

// Point the data layer at our isolated database before it is imported. Each
// test file runs in its own worker, so this never affects other suites (e.g.
// bookmarks.test.ts, which uses the shared control database directly). The
// pool connects lazily on first query, which happens after beforeAll creates
// the database below.
if (controlUrl) {
  process.env.DATABASE_URL = deriveDatabaseUrl(controlUrl, SUITE_DB)
}
process.env.HARBOR_BOOTSTRAP_ADMIN_EMAIL = ""
process.env.HARBOR_BOOTSTRAP_ADMIN_PASSWORD = ""
process.env.HARBOR_BOOTSTRAP_ADMIN_NAME = ""

async function createUser(raw: Client, email: string): Promise<number> {
  const { rows } = await raw.query(
    `INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id`,
    [email]
  )
  return Number(rows[0].id)
}

describe.skipIf(!controlUrl)("api keys", () => {
  let raw: Client
  let keys: typeof import("./api-key")
  let ownerA = 0
  let ownerB = 0

  beforeAll(async () => {
    const control = new Client({ connectionString: controlUrl! })
    await control.connect()
    try {
      await control.query(`DROP DATABASE IF EXISTS ${SUITE_DB}`)
      await control.query(`CREATE DATABASE ${SUITE_DB}`)
    } finally {
      await control.end()
    }

    await runMigrations(deriveDatabaseUrl(controlUrl!, SUITE_DB))

    raw = new Client({
      connectionString: deriveDatabaseUrl(controlUrl!, SUITE_DB),
    })
    await raw.connect()

    keys = await import("./api-key")

    ownerA = await createUser(raw, "key-owner-a@example.com")
    ownerB = await createUser(raw, "key-owner-b@example.com")
  })

  afterAll(async () => {
    await raw.end()
    // End the data-layer pool before dropping the database, otherwise the
    // forced drop severs its idle connections and vitest reports unhandled
    // "terminating connection" errors.
    const { pool } = await import("@/db/client")
    await pool.end()
    await dropTestDatabase(SUITE_DB)
  })

  it("create → resolve → list → revoke lifecycle", async () => {
    const created = await keys.createApiKey(ownerA, "iphone")
    expect(created.key.startsWith("hm_")).toBe(true)

    const user = await keys.getApiKeyUser(created.key)
    expect(user?.id).toBe(ownerA)
    expect(user?.email).toBe("key-owner-a@example.com")

    const listed = await keys.listApiKeysByUser(ownerA)
    expect(listed).toHaveLength(1)
    expect(listed[0]?.name).toBe("iphone")
    // The raw key is never exposed via listing.
    expect(listed[0]).not.toHaveProperty("key")
    expect(listed[0]).not.toHaveProperty("keyHash")

    expect(await keys.revokeApiKey(ownerA, created.id)).toBe(true)
    expect(await keys.getApiKeyUser(created.key)).toBeNull()
    expect(await keys.listApiKeysByUser(ownerA)).toHaveLength(0)
    // A revoked key stays revoked.
    expect(await keys.revokeApiKey(ownerA, created.id)).toBe(false)
  })

  it("one user cannot revoke another user's key", async () => {
    const created = await keys.createApiKey(ownerB, "b-key")

    expect(await keys.revokeApiKey(ownerA, created.id)).toBe(false)
    expect((await keys.getApiKeyUser(created.key))?.id).toBe(ownerB)
    expect(await keys.listApiKeysByUser(ownerA)).toHaveLength(0)

    expect(await keys.revokeApiKey(ownerB, created.id)).toBe(true)
  })

  it("rejects blank keys, wrong prefixes, and unknown keys", async () => {
    expect(await keys.getApiKeyUser(null)).toBeNull()
    expect(await keys.getApiKeyUser("")).toBeNull()
    expect(await keys.getApiKeyUser("Basic abc")).toBeNull()
    const { key } = await keys.createApiKey(ownerA, "probe")
    expect(await keys.getApiKeyUser(`${key}nope`)).toBeNull()
    expect(await keys.revokeApiKey(ownerA, -1)).toBe(false)
  })
})
