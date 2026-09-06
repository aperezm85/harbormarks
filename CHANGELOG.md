# Changelog

Single source of truth for release notes. The in-app changelog
(`src/lib/changelog.ts`), README "Recent Changes", and INSTRUCTIONS "Recent
Changes" are synced from here on every release.

## v0.9.11 — 2026-09-06

- Click-to-read: opening an unread bookmark marks it as reading with rollback on failure.
- Save/edit dialog redesign with preview header, favorites switch, inline delete.
- `N` keyboard shortcut opens the save-a-link dialog on the dashboard.
- Freedium mirror URLs fetch metadata from the inner article URL.
- Avatar upload from the profile page with floating toasts.
- No schema migration: drop-in image swap.

## v0.9.10 — 2026-09-06

- Private per-bookmark notes, searchable, never clobbered by metadata refetch.
- Read status (`unread` / `reading` / `archived`), Unread filter, `is:` operators filter.
- Migrations `0006` (note + search index rebuild) and `0007` (status). Back up before upgrading.

## v0.9.9 — 2026-09-06

- Card view selector: grid / list / compact, persisted in localStorage.
- No schema migration: drop-in image swap.

## v0.9.8 — 2026-09-05

- Compact card redesign, relative timestamps, brighter preview images.
- No schema migration: drop-in image swap.

## v0.9.7 — 2026-09-03

- Search operators (`tag:`, `site:`, `is:`, `has:`, `before:`, `after:`) with chips.
- No schema migration: drop-in image swap.

## v0.9.6 — 2026-09-03

- Metadata enrichment columns (`site_name`, `author`, `published_at`, `language`, `canonical_url`) via migration `0005`.
- `node-html-parser` replaces regex extraction; charset-aware decoding.

## v0.9.5 — 2026-09-02

- Import from JSON / Netscape HTML with duplicate reconciliation.
- Sonner stylesheet fix for floating toasts.
- No schema migration: drop-in image swap.

## v0.9.4 — 2026-08-31

- Permanent delete from Trash; indexed full-text search; tags migration preserves data.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` all pass.
