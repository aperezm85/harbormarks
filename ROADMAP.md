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
- Tag management screen for rename, merge, and global delete.
- Save/edit UX improvements, keyboard shortcuts, and avatar/profile improvements.
- Private bookmark notes and read-state tracking.
- Liveness probe, deployment hardening, CI workflow, and security defaults.
- Public repo hardening: CODEOWNERS, branch protection, and squash-only merge policy.

## Remaining high-value work

### 1) Broken link monitoring

Why:

- A bookmark manager loses trust when links silently rot.

Scope:

- Background health checks for bookmarked URLs.
- Store last-checked timestamp and status.
- Show dead/redirecting/healthy badges in the UI.

Acceptance criteria:

- Users can quickly identify broken links.
- Health checks do not block the normal browsing experience.

### 2) Bulk actions on bookmarks

Why:

- This becomes important as collections grow beyond a few hundred entries.

Scope:

- Multi-select dashboard actions.
- Bulk delete, tag add/remove, favorite toggle, and archive/unarchive.
- Clear selection state and undo-friendly behavior.

Acceptance criteria:

- Actions apply only to selected bookmarks.
- Selected count is visible and cancel/reset is obvious.

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

### 4) Keyboard-first workflow

Why:

- It helps power users work faster without sacrificing clarity.

Scope:

- Keyboard shortcuts for search focus, save dialog, and common card actions.
- Optional command palette for frequent filters and tag jumps.

Acceptance criteria:

- Core actions are usable without a mouse.
- Shortcut behavior is discoverable and avoids conflicts.

## Not on the active roadmap

These are intentionally omitted because they are already done or no longer worth prioritizing in the current product direction:

- Duplicate resolution UX for save-if-existing
- Tag management screen (already shipped)
- Import/export work (already shipped)
- Metadata enrichment expansion (already shipped)
- Notes and read-state tracking (already shipped)
- Card layout and dashboard improvements (already shipped)
- Search operator rollout (already shipped)
- Pinning/priority management (low priority relative to current needs)

## Suggested order

1. Broken link monitoring
2. Bulk actions on bookmarks
3. Search and filter polish
4. Keyboard-first workflow

This keeps the roadmap focused on the remaining work that meaningfully improves trust, scale, and day-to-day usability without repeating features already shipped.

Resequenced after the 0.9.4 survey. Import/export moved to the front: it is what
makes the app trustworthy, and it is what lets people migrate _to_ it.

- 0.9.5: Close the hardening phase - CI gates, remove the SEO scaffolding, add
  `/healthz`, and land a first test suite.
- 0.9.6: Replace the regex HTML parser and land metadata enrichment.
- 0.10: Export, then import. Duplicate resolution UX.
- 0.11: Search operators, richer filters, tag management.
- 0.12: Notes, broken-link monitoring.
- 0.13: Bulk actions, keyboard workflow, command palette.

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
