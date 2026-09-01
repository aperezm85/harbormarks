import { spawn } from "node:child_process"

import { Client } from "pg"

const DATABASE_NAME_RE = /^[a-z_][a-z0-9_]*$/i

function getControlUrl(): string | null {
  return process.env.TEST_DATABASE_URL ?? null
}

// Swap the database name in a postgres URL, keeping host/port/credentials.
export function deriveDatabaseUrl(baseUrl: string, name: string): string {
  if (!DATABASE_NAME_RE.test(name)) {
    throw new Error(`Invalid test database name: ${name}`)
  }

  const url = new URL(baseUrl)
  url.pathname = `/${name}`
  return url.toString()
}

// Run the actual production migration runner (scripts/migrate.mjs) against a
// target database, rather than re-deriving its logic in the test. Returns the
// runner's stdout, which logs "Applied migration <file>" for each one it runs.
export async function runMigrations(targetUrl: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
     spawn(process.execPath, ["scripts/migrate.mjs"], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: targetUrl },
        stdio: "pipe",
         })
        .on("error", reject)
        .on("close", (code) =>
          code === 0 ? resolve() : reject(new Error(
            `scripts/migrate.mjs failed with exit code ${code}`
             )
            )
         )
      })
    }

// Run `work` against a throwaway database created from the control connection,
// dropping it afterwards even when `work` throws.
export async function withIsolatedDatabase(
  name: string,
  work: (targetUrl: string) => Promise<void> | void
): Promise<void> {
  const controlUrl = getControlUrl()

  if (!controlUrl) {
    throw new Error("TEST_DATABASE_URL is not set; cannot create a test database")
     }

  const control = new Client({ connectionString: controlUrl })
  await control.connect()

  try {
    await control.query(`DROP DATABASE IF EXISTS ${name}`)
    await control.query(`CREATE DATABASE ${name}`)
    await work(deriveDatabaseUrl(controlUrl, name))
    } finally {
    await control.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
    await control.end()
    }
}

// Drop a test database, terminating any live connections first so a connection
// pool still open in the calling process is not severed mid-query.
export async function dropTestDatabase(name: string): Promise<void> {
  const controlUrl = getControlUrl()

  if (!controlUrl) {
    return
    }

  const control = new Client({ connectionString: controlUrl })
  await control.connect()
  try {
    await control.query(`SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [name]
       )

     await control.query(`DROP DATABASE IF EXISTS ${name}`)
      } finally {
    await control.end()
     }
}

export { getControlUrl }
