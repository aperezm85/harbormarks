# Changelog

Single source of truth for release notes. The in-app changelog
(`src/lib/changelog.ts`), README "Recent Changes", and INSTRUCTIONS "Recent
Changes" are synced from here on every release.

## v1.1.1 — 2026-09-20

- Per-user digest schedule: each user picks a weekday (dropdown, Sunday by default) and an hour (`00:00`–`23:00`, `07:00` by default) on the profile page. The in-process scheduler ticks every minute with a once-per-day guard and a startup catch-up run; manual "Send now" never touches the guard, so it can't block the automatic send. Migration `0010` is additive (`send_day`/`send_time` on `digest_preferences`, Sunday 07:00 defaults). `TZ` is pinned to UTC in the image and both Compose files — override it to run the schedule in local time.
- Bookmark asset proxy (`/api/bookmarks/assets`) no longer throws a 500 for unfetchable targets: SSRF-blocked hosts, DNS failures, timeouts, and redirect loops now return `404 { error: "Unable to fetch asset" }`, and cache writes are best-effort so disk errors can't fail an otherwise good fetch.
- Profile page redesign: removed the redundant Account details card (name/email already live in the editable Profile card) and reordered to a single column — Profile picture, Profile, Change password, Weekly digest.
- Profile and admin Users pages share a new dashboard-style header (logo home link, title, theme toggle, logout); Users rows use design-system `Badge` pills and surface create/update feedback in a banner under the header.
- Security dependencies: `pnpm audit` went from 9 findings (1 critical) to 0 via `astro` 7.2.6 → 7.3.3, `shadcn` 4.19.0 → 4.21.0, and bumped `pnpm-workspace.yaml` overrides (`hono`, `js-yaml`, plus new `svgo`/`devalue` pins, all as caret minimums so future patches flow).
- Replaced `clsx` + `tailwind-merge` with the drop-in `cn` package (Tailwind v4 compatible); `src/lib/utils.ts` is now a single re-export and all 24 `cn` consumers are unchanged.
- New unit tests cover the digest schedule helpers (`normalize`/`is` day/time validators and the due-date guard, extracted DB-free into `src/lib/digest-schedule.ts`).
- No breaking changes; one additive migration (`0010`). Back up before upgrading, as usual.

## v1.1.0 — 2026-09-13

- Weekly digest email: opt-in from the profile page ("Weekly digest" card), sent Sunday morning with your unread links — title, description, your private note, tags, and saved date. Choose the content: unread from the last 7 days, all unread, or everything saved in the last 7 days. A "Send now" button emails the current selection on demand (10/hour limit).
- Digest links are tracked: clicking one records unread → reading plus a visit (same as opening the card in-app) via a signed redirect, then lands on the saved page. Works logged out on any device; archived bookmarks are never changed. Signatures use an auto-generated secret stored in a new `app_settings` table — no setup needed.
- Real password reset and email verification delivery over SMTP (`HARBOR_SMTP_*`). Without SMTP configured, links keep falling back to the server log so single-user setups keep working.
- Email templates follow the emailcn.run registry blocks (newsletter block for the digest, auth link block for reset/verify); the registry alias lives in `components.json` (`@emailcn`).
- New `digest_preferences` table via migration `0008` (additive, per-user opt-in defaulting to off). Migration `0009` adds `app_settings` for the link-signing secret. Back up before upgrading, as usual.
- Operators can trigger the weekly run from an external scheduler via `POST /api/digest/run` with `HARBOR_CRON_SECRET` instead of the built-in Sunday timer.
- Login page shows password-reset and email-verification confirmations as success notices instead of misusing the error toast.

## v1.0.0 — 2026-09-06

- Saving an existing URL now returns the existing bookmark and offers open, merge-tags, or save-anyway instead of a bare error.
- New tag management screen (`/tags`, linked from the sidebar): rename a tag everywhere, merge one tag into another, or delete a tag from all bookmarks.
- New unauthenticated liveness probe at `GET /api/healthz` for Docker healthchecks and reverse proxies.
- User-uploaded avatars survive rebuilds via a persistent `uploads_data` volume; back it up alongside the database.
- Internet-facing defaults locked down: deploy compose ships closed registration and forces a real bootstrap password.
- Pull requests now run lint, typecheck, and tests via a dedicated CI workflow.
- `CHANGELOG.md` is the single source of truth for release notes (README links to it); new `SECURITY.md`, bug/feature issue templates, and uploads backup/restore docs.
- No schema migration ships in this release, so upgrading is a drop-in image swap with no restart-time table rewrite.

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
