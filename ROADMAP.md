# HarborMarks Roadmap

What is coming next. For what has already shipped, see
[CHANGELOG.md](./CHANGELOG.md), which is the single source of truth for releases.

## Product goals

- Make saved links easy to find and trust over time.
- Reduce friction when organizing large bookmark collections.
- Keep the app portable, safe, and easy to self-host.

## Next up

### Mobile-web polish (PWA + `/save`, no native app)

Why: the mobile base exists (viewport meta, mobile sidebar, `/save` quick-save
page, iOS Shortcut guide, API keys, browser extension). A native app is out of
scope for a self-hosted app.

- PWA: `manifest.webmanifest`, icons, and `theme-color`; installable, no
  offline database.
- Responsive audit at 360px: dashboard, top bar, cards, dialogs, `/save`,
  `/tags`, profile. No horizontal scroll.
- `/save` polish: large tap target and an already-saved card.

Done when: Lighthouse reports the PWA as installable, and share sheet →
`/save` → Save works one-handed at 360px.

## Later

Smaller follow-ups on features that already shipped:

- **Search:** saved searches / named filters; relative date shorthand such as
  `after:7d`.
- **Keyboard:** shortcuts on `/tags` and `/profile` (today they run only on the
  dashboard pages); a first-visit hint for `?`.

Quality and infrastructure:

- Tests for the API routes (auth, bulk, import, digest, link health) and for the
  keyboard handler.
- CI check that migrations apply to both a fresh database and an upgrade, and
  that the database-backed tests run (they are skipped without
  `TEST_DATABASE_URL`).
- Browser extension: tests and a packaging/release step.
- Verify the arm64 image in CI (CI builds amd64 only).

## Not planned

- **Native mobile app:** out of self-host scope; the PWA, `/save`, API keys, and
  the extension cover mobile.
- **Live writable public demo:** hosting cost and abuse handling; use
  screenshots, seed data, or ephemeral Codespaces instead.
- **Pinning / priority management:** low priority for now.

## Shipped

One line per release; details in the changelog.

| Version | Highlights |
| --- | --- |
| v1.7.0 | Search polish: URL-backed search and view, view-scoped search, `-` exclusions, documented operator rules; fixed a `site:` cross-user leak |
| v1.6.0 | Keyboard-first workflow: card focus, action keys, `g` chords, `Ctrl/Cmd+K` palette, `?` cheat sheet |
| v1.5.0 | Collection Dashboard on its own `/dashboard` page |
| v1.4.0 | Bulk actions: multi-select with shift-click ranges, `POST /api/bookmarks/bulk` |
| v1.3.x | Broken link monitoring: daily opt-in checks, Broken badge, `is:broken`, on-demand re-check |
| v1.2.2 | Deployment docs consolidation and migration guides (docs only) |
| v1.2.1 | Medium/Freedium metadata fixes |
| v1.2.0 | Quick-save suite: API keys, `/save` page, browser extension, copy-link |
| v1.1.x | Weekly digest email with click tracking, SMTP delivery, per-user schedule, tag suggestions |
| v1.0.0 | Tag management, duplicate resolution, liveness probe, CI and deployment hardening |
| v0.9.x | Migrations, full-text search and operators, Trash, import/export, metadata, notes, read state |

Also shipped without a version bump: public repo hardening (CODEOWNERS, branch
protection, squash-only merges) and community files (`CONTRIBUTING.md`, issue
templates, support paths).

## Engineering notes

- Keep new filters URL-driven for persistence and sharing.
- Reuse existing API patterns under `pages/api/bookmarks`.
- Extend `BookmarkCardData` incrementally to avoid large breaking changes.
- Schema changes go in a new numbered file under `migrations/`, applied at
  startup by `scripts/migrate.mjs` and recorded in `schema_migrations`. Never
  edit a migration that has already shipped, and never write one that drops a
  column holding user data.
- Keep `src/db/schema.ts` in step with the migrations; nothing reconciles them.

## Definition of done

- API implemented with validation and error responses.
- Every query scoped by `user_id`.
- UI integrated in dashboard/sidebar/dialog flows.
- `pnpm lint`, `pnpm typecheck`, and `pnpm build` all pass.
- Migrations tested against both a fresh database and an upgrade from the
  previous release.
- Happy-path and error-path manual tests documented in the PR.
