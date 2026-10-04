// Quick script to insert a test bookmark with link_health = 'broken'.
// Run: DATABASE_URL=... node scripts/add-broken-link.mjs
// Uses plain `pg` + SQL so it runs under plain node (no TS loader needed).

import { Pool } from "pg"

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set")
}

const pool = new Pool({ connectionString: DATABASE_URL })

const userRes = await pool.query(`SELECT id FROM users ORDER BY id LIMIT 1`)
if (userRes.rowCount === 0) {
  console.error("No users found. Create one first via the app.")
  process.exit(1)
}

const userId = userRes.rows[0].id

const insertRes = await pool.query(
  `INSERT INTO bookmarks (user_id, url, title, description, tags, link_health, created_at, updated_at)
   VALUES ($1, $2, $3, $4, $5, 'broken', NOW(), NOW())
   RETURNING id`,
  [
    userId,
    "https://thisisnotarealwebsite.demo.invalid/broken-link-test",
    "Broken Link Test",
    "A test bookmark with a dead link. It should show a red 'Broken' badge on the card.",
    ["test", "broken"],
  ]
)

console.log(
  `Inserted bookmark id=${insertRes.rows[0].id} with link_health='broken' for user_id=${userId}`
)
console.log(`URL: https://thisisnotarealwebsite.demo.invalid/broken-link-test`)
console.log(`You can now see it with: tag:broken or is:broken in the app.`)

await pool.end()
