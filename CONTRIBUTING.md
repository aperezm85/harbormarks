# Contributing to HarborMarks

Thanks for helping out. This is the fastest path from a fresh clone to a merged PR.

## Quick start

Prerequisites: Node 22, pnpm 12 (`packageManager` in `package.json`), and a
PostgreSQL 17 database (or Docker Compose, see `INSTRUCTIONS.md` §3–§4).

```bash
pnpm install
cp .env.example .env   # then set DATABASE_URL to your database
pnpm dev
```

Docker path (app + database together) is documented in `INSTRUCTIONS.md` §4
(`docker compose up -d --build`, app on `http://<NAS_IP>:3000/login`).

## Scripts

| Command           | What it does                                  |
| ----------------- | --------------------------------------------- |
| `pnpm dev`        | Local dev server                              |
| `pnpm build`      | Production build (`astro build`)              |
| `pnpm preview`    | Serve the production build locally            |
| `pnpm lint`       | ESLint over the repo (must stay clean)        |
| `pnpm typecheck`   | `astro check` (run separately — build alone does not typecheck) |
| `pnpm test`       | Vitest suite (`vitest run`)                   |
| `pnpm db:migrate` | Apply pending migrations (`scripts/migrate.mjs`) |

Database-backed tests skip when `TEST_DATABASE_URL` is unset and run fully when
it is set:

```bash
TEST_DATABASE_URL=postgresql://astro:astro@localhost:5432/harbormarks_test pnpm test
```

CI (`.github/workflows/ci.yml`) runs `lint` + `typecheck` + `test` on every PR
and on pushes to `main`. Match it locally before opening a PR:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

## Migration rules

Schema lives in numbered files under `migrations/`, applied at container start
by `scripts/migrate.mjs` and recorded in `schema_migrations`. Full conventions
in `IMPLEMENTATION.md` house rules and `ROADMAP.md` engineering notes.

- Add a new numbered file; **never edit a migration that has already shipped**.
- **Never write a migration that drops a column holding user data.**
- Make migrations idempotent (`IF NOT EXISTS`, or a guard on
  `information_schema.columns`) so re-running is safe.
- Update `src/db/schema.ts` in the same change — nothing reconciles the two
  automatically.
- Test against both a fresh database and an upgrade from the previous release.

## PR checklist

- [ ] Linked the `ROADMAP.md` item (or issue) this PR addresses.
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` all pass.
- [ ] Migration rules above followed (if the PR touches schema).
- [ ] Every new query is scoped by `user_id` (see `IMPLEMENTATION.md` data isolation).
- [ ] Manual test notes included: happy-path steps plus at least one error path
      (e.g. invalid input, unauthenticated request, duplicate URL).
- [ ] No secrets, credentials, or local `.env` values committed.

Every change requires maintainer review (`CODEOWNERS`); the `main` branch is
protected and PRs merge squash-only.

## Release notes

`CHANGELOG.md` is the single source of truth for release notes. The in-app
changelog (`src/lib/changelog.ts`), README "Recent Changes", and INSTRUCTIONS
"Recent Changes" are synced from it on every release — do not update them in
feature PRs.
