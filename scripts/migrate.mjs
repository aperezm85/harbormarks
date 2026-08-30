import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { Client } from "pg"

const currentFilePath = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFilePath)
const projectRoot = path.resolve(currentDir, "..")
const migrationsDir = path.join(projectRoot, "migrations")

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error("DATABASE_URL is required to run migrations.")
  process.exit(1)
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `)
}

async function listMigrationFiles() {
  const entries = await readdir(migrationsDir, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))
}

async function main() {
  const client = new Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    await ensureMigrationsTable(client)

    const appliedResult = await client.query(
      `SELECT name FROM schema_migrations ORDER BY name`
    )
    const appliedMigrations = new Set(
      appliedResult.rows.map((row) => String(row.name))
    )

    const migrationFiles = await listMigrationFiles()

    for (const fileName of migrationFiles) {
      if (appliedMigrations.has(fileName)) {
        continue
      }

      const migrationPath = path.join(migrationsDir, fileName)
      const sql = await readFile(migrationPath, "utf8")

      await client.query("BEGIN")

      try {
        await client.query(sql)
        await client.query(
          `INSERT INTO schema_migrations (name) VALUES ($1)`,
          [fileName]
        )
        await client.query("COMMIT")
        console.log(`Applied migration ${fileName}`)
      } catch (error) {
        await client.query("ROLLBACK")
        throw error
      }
    }
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})