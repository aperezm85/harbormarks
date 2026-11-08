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
- Per-user digest schedule, profile/users redesign, and dependency hardening (v1.1.1).
- Metadata tag suggestions and paste-to-fetch in the save dialog (v1.1.2).
- Quick-save suite: API keys, `/save` page, browser extension, copy-link button (v1.2.0, out-of-scope addition that bumped the minor).
- Search and filter polish: URL-backed search and view, view-scoped search, `-` exclusions, documented combining rules, `site:` security fix (v1.7.0, no migration).
- Keyboard-first workflow: `/` search, `j`/`k` card focus, per-card action keys, `g`-chord navigation, `Ctrl/Cmd+K` command palette, `?` cheat sheet (v1.6.0, no migration).
- Bulk actions on bookmarks: Gmail-style multi-select with shift-click ranges, tri-state header checkbox, and bulk delete/tag/favorite/archive via `POST /api/bookmarks/bulk` (v1.4.0).
- Collection Dashboard as a dedicated `/dashboard` page (`/health` redirects), with cleanup-focused blocks and a one-click "Re-run checker" for broken links (v1.5.0, no migration).
- Medium/Freedium metadata fixes and bot-protection hardening (v1.2.1, patch, no migration).
- Liveness probe (`GET /api/healthz`), deployment hardening, CI workflow, and security defaults (v1.0.0).
- Public repo hardening: CODEOWNERS, branch protection, and squash-only merge policy.
- Deployment docs consolidation: `.env.example` matching actual reads, canonical
  env-var reference table, ports/backup/upgrade docs (v1.2.2, docs only, no migration).
- Migration guides for Pocket / Raindrop / browsers plus HarborMarks JSON
  round-trip, linked from README and the import dialog (v1.2.2, docs only, no migration).
- Community hygiene (docs only, no version bump): README badges/links to
  `CHANGELOG.md` and `ROADMAP.md`, new `CONTRIBUTING.md`, README Support section
  with issue templates and security-advisory path.

## Remaining high-value work

### 1) Bulk actions on bookmarks (shipped in v1.4.0)

Why:

- This becomes important as collections grow beyond a few hundred entries.

Shipped in v1.4.0:

- Gmail-style multi-select with shift-click ranges and a tri-state header checkbox.
- `POST /api/bookmarks/bulk` (500-id cap) for soft delete, favorite/unfavorite, archive/unarchive, and tag add/remove via a dialog.
- Sticky toolbar above the cards; selection clears after every action and on view change; optimistic UI with rollback.

### 2) Broken link monitoring (shipped in v1.3.0)

Why:

- A bookmark manager loses trust when links silently rot.

Shipped in v1.3.0:

- Daily opt-in health checks for bookmarked URLs (`HARBOR_LINK_HEALTH_*`).
- `link_health` column (`unknown` / `checking` / `ok` / `broken`), orthogonal to read status.
- Dead/healthy badges in the UI, `is:broken` operator, auto-managed `broken` tag, `broken` digest scope.

Scope (as originally planned):

- Background health checks for bookmarked URLs.
- Store last-checked timestamp and status.
- Show dead/redirecting/healthy badges in the UI.

Acceptance criteria:

- Users can quickly identify broken links.
- Health checks do not block the normal browsing experience.

### 3) Search and filter polish (shipped in v1.7.0)

Shipped: search text and view in the URL (also on tag, favorites, and trash
pages), search scoped to the current view, `-` exclusions, predictable operator
combining (documented in the README), pasted-URL `site:`, stricter `has:image`,
and visible warnings for bad dates and unknown filters. Also fixed a
`site:` precedence bug that leaked rows across users.

Remaining polish:

- Saved searches / named filters.
- `before:`/`after:` shorthand such as `after:7d`.

### 4) Keyboard-first workflow (shipped in v1.6.0)

Shipped: `/` focuses search, `j`/`k` move card focus, the focused card takes
`Enter`/`o`, `e`, `f`, `a`, `c`, `#`, `x`/`Shift+X`; `g` chords navigate;
`Ctrl/Cmd+K` opens a command palette; `?` shows the cheat sheet. The keymap
lives in `src/lib/keyboard-shortcuts.ts` and drives both the handler and the
cheat sheet.

Remaining polish:

- Shortcuts only run on the dashboard-family pages (not `/tags` or `/profile`).
- No first-visit nudge for `?`.

### 5) Mobile-web polish (PWA + `/save` UX, no native app)

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
- Quick-save suite: API keys, `/save`, browser extension, copy-link (shipped v1.2.0)
- Deployment docs consolidation (shipped in v1.2.2, docs only)
- Migration guides (shipped in v1.2.2, docs only)
- Community hygiene: badges, CONTRIBUTING, support paths (shipped, docs only, no version bump)
- Pinning/priority management (low priority relative to current needs)
- Live writable public demo (deferred: hosting cost + abuse/spam handling;
  use screenshots, seed data, or ephemeral Codespaces instead)
- Native mobile app (deferred: out of self-host scope; PWA + `/save` + API
  keys + extension cover mobile; see remaining item 5)
- New import parsers (shipped: HarborMarks JSON, Netscape HTML covering
  browsers/Raindrop/Instapaper, Pocket CSV, generic CSV; migration guides
  shipped in v1.2.2)

## Suggested order

1. Bulk actions on bookmarks (shipped in v1.4.0)
2. Broken link monitoring (shipped in v1.3.0)
3. Search and filter polish (shipped in v1.7.0)
4. Keyboard-first workflow (shipped in v1.6.0)
5. Mobile-web polish (PWA + `/save` UX, no native app)

This keeps the roadmap focused on the remaining work that meaningfully improves trust, scale, and day-to-day usability without repeating features already shipped.

Release history: v1.0.0 closed duplicate UX, tag management, and
operational hardening; v1.1.0 added the out-of-scope weekly digest plus
real SMTP delivery, which is why the minor version moved; v1.1.1 added
per-user digest schedules and profile hardening; v1.1.2 added metadata tag
suggestions and paste-to-fetch; v1.2.0 added the out-of-scope quick-save suite
(API keys, `/save` page, browser extension, copy-link), which is why the minor
moved again; v1.2.1 shipped Medium/Freedium metadata fixes as a patch;
v1.2.2 shipped the deployment docs consolidation and migration guides as a
docs-only patch with no schema migration; v1.3.0 shipped opt-in broken link
monitoring (daily checks, Broken badge, is:broken, broken digest scope, one
additive migration `0012_link_health.sql`) plus the list-view card-width fix.
Community hygiene landed after v1.2.2
as a docs-only change with no schema migration and no version bump; v1.4.0
shipped bulk bookmark actions (multi-select, `POST /api/bookmarks/bulk`)
with no schema migration; v1.5.0 moved the Collection Dashboard to its own
`/dashboard` page, also with no schema migration; v1.6.0 shipped the
keyboard-first workflow (card focus, action keys, `g` chords, command palette,
cheat sheet), again with no schema migration; v1.7.0 shipped search and filter polish plus a
`site:` cross-user leak fix, with no schema migration.

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
