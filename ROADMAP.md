# HarborMarks Roadmap

This roadmap reflects the work already shipped in the changelog and keeps only the remaining high-value items worth doing next.

## Product goals

- Make saved links easy to find and trust over time.
- Reduce friction when organizing large bookmark collections.
- Keep the app portable, safe, and easy to self-host.

## Already shipped

The following items are complete and reflected in the changelog:

- Versioned startup migrations and schema safety.
- PostgreSQL indexing for search and sortable views.
- Soft-delete workflow with Trash, restore, and permanent delete.
- Recency-based "Most visited" ranking.
- URL canonicalization and per-user duplicate prevention.
- Import and export support (JSON + Netscape HTML; CSV/JSON export).
- Metadata enrichment for page detail fields.
- Search operators and tag/site/is/has/before/after filters.
- Card view selector and compact/list/grid layouts.
- Tag management screen for rename, merge, and global delete (v1.0.0).
- Save/edit UX improvements, keyboard shortcut (`N` to open save, v0.9.11), and avatar/profile improvements.
- Private bookmark notes and read-state tracking (v0.9.10).
- Duplicate resolution UX for save-if-existing: open existing / merge tags / save anyway (v1.0.0).
- Weekly digest email with click tracking, plus real SMTP delivery for password
  reset and email verification (v1.1.0, out-of-scope addition that bumped the minor).
- Liveness probe (`GET /api/healthz`), deployment hardening, CI workflow, and security defaults (v1.0.0).
- Public repo hardening: CODEOWNERS, branch protection, and squash-only merge policy.
- Deployment docs consolidation: `.env.example` matching actual reads, canonical
  env-var reference table, ports/backup/upgrade docs (v1.2.2).
- Migration guides for Pocket / Raindrop / browsers plus HarborMarks JSON
  round-trip, linked from README and the import dialog (v1.2.2, docs only).

## Remaining high-value work

### 1) Bulk actions on bookmarks

Target: v1.3.0 (next up — unlocks cleanup of large imported collections).

Why:

- This becomes important as collections grow beyond a few hundred entries.

Scope:

- Multi-select dashboard actions.
- Bulk delete, tag add/remove, favorite toggle, and archive/unarchive.
- Clear selection state and undo-friendly behavior.

Acceptance criteria:

- Actions apply only to selected bookmarks.
- Selected count is visible and cancel/reset is obvious.

### 2) Broken link monitoring

Why:

- A bookmark manager loses trust when links silently rot.

Scope:

- Background health checks for bookmarked URLs.
- Store last-checked timestamp and status.
- Show dead/redirecting/healthy badges in the UI.

Acceptance criteria:

- Users can quickly identify broken links.
- Health checks do not block the normal browsing experience.

### 3) Search and filter polish

Why:

- Search is good already, but the metadata model and filtering UX still have room to become faster and more consistent.

Scope:

- Tighten combined operator behavior.
- Make domain and image-related filters more consistent.
- Improve saved/filter state in the URL for easier sharing and reload behavior.

Acceptance criteria:

- Operators combine predictably.
- Filter state remains stable across refreshes and deep links.

### 4) Keyboard-first workflow (remainder)

Shipped so far: `N` opens the save dialog (v0.9.11), plus save/edit dialog shortcuts.

Why:

- It helps power users work faster without sacrificing clarity.

Scope:

- Keyboard shortcuts for search focus, save dialog, and common card actions.
- Optional command palette for frequent filters and tag jumps.

Acceptance criteria:

- Core actions are usable without a mouse.
- Shortcut behavior is discoverable and avoids conflicts.

## Docs, onboarding, and community track

Product work above (1-4) stays the priority. The items below are docs-only
or low-risk UI polish that can land in parallel in any `v1.3.x` docs release
without a version bump (items 5-6 already shipped in v1.2.2, §8 shipped as a
docs-only change; only §7 remains).
No new import parsers, no native app, no public demo
instance (see "Not on the active roadmap").

### 5) Deployment docs consolidation (shipped in v1.2.2)

Why:

- Deployment knowledge exists but is scattered across `README.md`,
  `INSTRUCTIONS.md`, compose files, and `SECURITY.md`, and `.env.example`
  is stale.

Scope:

- Fix `.env.example` (drop legacy `HARBOR_USER`/`HARBOR_PASSWORD`, fix
  `PORT 4321` vs `3000`, add missing `HARBOR_ALLOW_SIGNUP`,
  `HARBOR_ALLOWED_DOMAINS`, `HARBOR_CHECK_ORIGIN`, `HARBOR_CORS_ORIGINS`,
  `HARBOR_CRON_SECRET`, `TZ`).
- Single env-var reference table: variable, required/optional, default,
  restart vs rebuild, where it is read.
- Ports section: app `3000`, db `5432` (LAN only), reverse-proxy note.
- Backup: link `db_data` dump + `uploads_data` tar from `INSTRUCTIONS.md` §9.
- Upgrade: generic `dump → git pull → up -d --build → check
  schema_migrations` plus pin-to-tag strategy; retire stale `0.9.4`-only notes.

Acceptance criteria:

- `.env.example` matches what the app actually reads.
- A fresh deploy and an upgrade are reproducible from README alone.

### 6) Migration guides (shipped in v1.2.2 — docs only, no new import code)

Why:

- Import already ships (`POST /api/bookmarks/import`: JSON, Netscape HTML,
  Pocket CSV, generic CSV with `url` column, `skip` / `merge-tags` /
  `create-anyway`, 10 MB cap) but users cannot discover how to leave
  Pocket / Raindrop / browsers.

Scope (docs only):

- New `INSTRUCTIONS.md` migration section + link from README and the
  import dialog: Pocket CSV → Import `auto`/`skip`, Raindrop HTML/CSV →
  Import, Chrome/Firefox HTML export → Import, HarborMarks JSON round-trip.
- Document duplicate strategies, 10 MB limit, `createdAt` preservation,
  and that import does no metadata fetch.
- Only if a real Raindrop CSV sample with a `url` column fails: add one
  small parser branch plus a test in `src/lib/bookmark-import.test.ts`.

Acceptance criteria:

- Each source guide yields the expected counts on a fresh account.
- Re-importing the same file with `skip` imports zero the second time.

### 7) Mobile-web polish (PWA + `/save` UX, no native app)

Why:

- Mobile base already exists (`viewport` meta, mobile sidebar,
  `useIsMobile`, `/save` quick-save page, iOS Shortcut guide, API keys,
  browser extension). A native app is out of scope for a self-hosted app.

Scope:

- PWA: `manifest.webmanifest` + icons + `theme-color`, installable,
  no offline DB.
- Responsive audit at 360px: dashboard, top bar, cards, dialogs, `/save`,
  `/tags`, profile. No horizontal scroll.
- `/save` UX polish: large tap target, already-saved card, logged-out
  `?next=` return (already works).

Acceptance criteria:

- PWA is installable per Lighthouse.
- Share-sheet → `/save` → Save works one-handed at 360px.

### 8) Community hygiene (shipped — docs only, no version bump)

Why:

- Changelog is done (`CHANGELOG.md` single source, in-app
  `src/lib/changelog.ts`, README link). Contribution and support paths
  are missing.

Scope:

- README badges/links to `CHANGELOG.md`, in-app changelog, and `ROADMAP.md`.
- New `CONTRIBUTING.md`: `pnpm dev/build/lint/typecheck/test`,
  migration rules (never edit shipped, idempotent, update `schema.ts`),
  PR checklist (roadmap link, manual test notes).
- New `README.md` Support section: GitHub Issues (bug/feature templates),
  Security Advisory for vulns, no-SLA note. Optionally enable Discussions.
- No code changes.

Acceptance criteria:

- A new contributor can set up and submit a PR from `CONTRIBUTING.md` alone.
- The support path is discoverable from the README.

## Not on the active roadmap

These are intentionally omitted because they are already done or no longer worth prioritizing in the current product direction:

- Duplicate resolution UX for save-if-existing (shipped v1.0.0)
- Tag management screen (already shipped, v1.0.0)
- Import/export work (already shipped)
- Metadata enrichment expansion (already shipped)
- Notes and read-state tracking (already shipped, v0.9.10)
- Card layout and dashboard improvements (already shipped)
- Search operator rollout (already shipped, v0.9.7)
- Liveness probe, CI hardening, deployment defaults (shipped v1.0.0)
- Email decision and weekly digest (shipped v1.1.0 as out-of-scope addition)
- Pinning/priority management (low priority relative to current needs)
- Live writable public demo (deferred: hosting cost + abuse/spam handling;
  use screenshots, seed data, or ephemeral Codespaces instead)
- Native mobile app (deferred: out of self-host scope; PWA + `/save` + API
  keys + extension cover mobile; see item 7)
- New import parsers (shipped: HarborMarks JSON, Netscape HTML covering
  browsers/Raindrop/Instapaper, Pocket CSV, generic CSV; migration guides
  shipped in v1.2.2, see item 6)

## Suggested order

1. Bulk actions on bookmarks (next up, target v1.3.0)
2. Broken link monitoring
3. Search and filter polish
4. Keyboard-first workflow (remainder)
5. Docs/community track in parallel (any order):
   mobile-web polish (§7, remaining), community hygiene (§8, shipped).
   Deployment docs (§5) and migration guides (§6) shipped in v1.2.2.

This keeps the roadmap focused on the remaining work that meaningfully improves trust, scale, and day-to-day usability without repeating features already shipped.

Release history: v1.0.0 closed duplicate UX, tag management, and
operational hardening; v1.1.0 added the out-of-scope weekly digest plus
real SMTP delivery, which is why the minor version moved; v1.2.0 added the
out-of-scope quick-save suite (API keys, `/save` page, browser extension,
copy-link), which is why the minor moved again; v1.2.2 shipped the
deployment docs consolidation (§5) and migration guides (§6) as a docs-only
patch with no schema migration. Community hygiene (§8) landed after v1.2.2 as a
docs-only change with no schema migration and no version bump.

## Engineering Notes

- Keep all new filters URL-driven for persistence and sharing.
- Reuse existing API patterns under pages/api/bookmarks for consistency.
- Extend BookmarkCardData incrementally to avoid large breaking changes.
- Schema changes go in a new numbered file under `migrations/`, applied at startup
  by `scripts/migrate.mjs` and recorded in `schema_migrations`. Never edit a
  migration that has already shipped, and never write one that drops a column
  holding user data.
- Keep `src/db/schema.ts` in step with the migrations; nothing reconciles them.

## Definition of Done per Feature

- API implemented with validation and error responses.
- Every query scoped by `user_id`.
- UI integrated in dashboard/sidebar/dialog flows.
- `pnpm lint`, `pnpm typecheck`, and `pnpm build` all pass.
- Migrations tested against both a fresh database and an upgrade from the
  previous release.
- Basic happy-path and error-path manual tests documented in PR.
