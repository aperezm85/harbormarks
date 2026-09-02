# HarborMarks Roadmap

This roadmap turns the current ideas into an execution plan with clear phases, outcomes, and acceptance criteria.

## Product Goals

- Make saved links easy to find and trust over time.
- Reduce friction for organizing large bookmark collections.
- Improve portability and ownership of user data.

## Shipped (0.9.3 - 0.9.5)

The hardening and correctness pass is complete. These were not on the original
roadmap; they came out of the code survey and are done:

- Versioned SQL migrations applied at startup, replacing request-time DDL.
- Tags stored as `TEXT[]`, with a data-preserving conversion from the old text column.
- Indexed PostgreSQL full-text search (generated `tsvector` column + GIN index),
  replacing wildcard scans.
- Indexes for every sort the UI offers.
- Paged bookmark lists; the duplicate first-paint fetch is gone.
- Soft delete with a Trash view, restore, undo, and permanent delete.
- Recency-weighted "Most visited" ranking backed by `last_visited_at`.
- URL canonicalization on write with per-user duplicate rejection.
- Export (`json`/`csv`/Netscape HTML) and import (JSON + Netscape HTML), reconciling
  against the user's own bookmarks on import.
- Toasts render floating and styled (Sonner stylesheet loaded).
- Local proxying and caching of favicons and preview images.
- Origin checking on by default; proxy-aware `Secure` cookies.
- SSRF-guarded outbound fetches with DNS-rebinding protection and size caps.
- Rate limiting on login, registration, and recovery; async `scrypt`.
- Automatic cleanup of expired sessions and tokens.
- Zero lint and typecheck errors.

Detailed specifications for everything below live in `IMPLEMENTATION.md`.

## Prioritization Framework

Each item is prioritized by:

- User impact: how much value users get day-to-day.
- Effort: estimated implementation complexity in this codebase.
- Risk reduction: how much it prevents data or UX issues later.

## Phase 1: Core Reliability and Retrieval (High Impact, Low-Medium Effort)

### 1) Duplicate Detection

**Status: partially shipped.** Canonicalization and per-user duplicate rejection are done. The duplicate *resolution* UX (open existing / merge tags / create anyway) is not - the API returns an error instead. See IMPLEMENTATION.md story 6.

Why:

- Prevents noisy collections and accidental repeats.

Scope:

- Normalize URL on create (already partly done with protocol normalization).
- Check existing bookmark by canonicalized URL.
- On duplicate, return a structured response with existing bookmark details.
- In dialog, show options: open existing, merge tags, or create anyway.

Acceptance criteria:

- Adding the same URL twice prompts duplicate handling.
- User can merge new tags into existing bookmark in one click.

### 2) Advanced Sorting and Filtering

**Status: partially shipped.** Recent, Most visited, Unorganized, Favorites, Trash, and tag filtering exist. Domain and has-image filters, and full URL-driven filter state, do not. See IMPLEMENTATION.md story 9.

Why:

- Retrieval speed matters most once collections grow.

Scope:

- Sort by created date, title, most visited, and last updated (if added).
- Filters: favorites, unorganized, tag(s), has preview image, domain.
- Persist current filter state in URL query params.

Acceptance criteria:

- Current filters survive refresh and sharing URL.
- Combined filters produce expected result sets.

### 3) Better Search Operators

**Status: not started, now unblocked.** Full-text search with ranking landed in 0.9.4, which was the prerequisite. See IMPLEMENTATION.md story 8.

Why:

- Text search alone does not scale for power users.

Scope:

- Add operators: tag:, domain:, favorite:true, has:image.
- Keep free-text fallback behavior.

Acceptance criteria:

- Operators work independently and in combination.
- Invalid operators fail gracefully (no crash, clear behavior).

## Phase 2: Organization at Scale (High Impact, Medium Effort)

### 4) Tag Management Screen

**Status: not started.** See IMPLEMENTATION.md story 10.

Why:

- Tags become hard to maintain without global operations.

Scope:

- New route for tag management.
- Rename tag globally.
- Merge tags (source -> target).
- Remove tag from all bookmarks.

Acceptance criteria:

- Tag rename updates all affected bookmarks.
- Merge preserves bookmarks from both source and target tags.

### 5) Bulk Actions on Bookmarks

**Status: not started.** See IMPLEMENTATION.md story 11.

Why:

- Major productivity lift for large collections.

Scope:

- Multi-select in dashboard.
- Bulk delete.
- Bulk add/remove tags.
- Bulk favorite/unfavorite.

Acceptance criteria:

- Actions apply to selected cards only.
- UI clearly shows selected count and supports cancel/reset.

### 6) Pinning and Priority

**Status: not started.** Lowest priority item on this roadmap; `is_favorite` already covers most of the need.

Why:

- Keeps important references visible.

Scope:

- Add isPinned field and pin/unpin action.
- Sort pinned first in selected views.

Acceptance criteria:

- Pinned cards stay on top within active filter context.

## Phase 3: Content Quality and Trust (Medium-High Impact, Medium Effort)

### 7) Broken Link Monitoring

**Status: not started.** The SSRF-guarded fetch helper it needs already exists in `src/lib/safe-fetch.ts`.

Why:

- Bookmark systems lose value when links silently rot.

Scope:

- Background endpoint/task to check URL health.
- Store link status and last checked timestamp.
- UI badge for dead/redirecting/ok.

Acceptance criteria:

- User can identify dead links quickly.
- Dead link checks do not block normal browsing UI.

### 8) Notes and Highlights

**Status: not started.** See IMPLEMENTATION.md story 12.

Why:

- Captures user intent and improves recall.

Scope:

- Add note field to bookmark model.
- Optional highlight/excerpt field.
- Show note preview on card and full note on edit.

Acceptance criteria:

- Notes are searchable and editable.
- Existing bookmarks unaffected when note is empty.

### 9) Metadata Enrichment Expansion

**Status: not started.** Blocked behind replacing the regex HTML parser. See IMPLEMENTATION.md story 7.

Why:

- Better card context improves confidence and scannability.

Scope:

- Add optional metadata: site name, author, published/updated date, language, canonical URL.
- Show compact subset on card; full set in details/edit modal.

Acceptance criteria:

- Metadata fetch gracefully handles missing fields.
- No card breakage if metadata is partial.

## Phase 4: Adoption and Portability (High Impact, Medium Effort)

### 10) Import and Export

**Status: not started. This is the highest-priority item on the roadmap.** An app that cannot hand back its data has not earned the word self-hosted. See IMPLEMENTATION.md stories 4 and 5.

Why:

- Critical for onboarding and user trust.

Scope:

- Import browser bookmark HTML.
- Export JSON and CSV.
- Optional dedupe strategy during import.

Acceptance criteria:

- Imported bookmarks preserve title, URL, and basic folder/tag mapping.
- Export can recreate user data in another system.

### 11) Keyboard-first Workflow

**Status: not started.**

Why:

- Power users benefit from fast navigation and capture.

Scope:

- Keyboard shortcuts for add dialog, search focus, and card actions.
- Optional command palette for quick filter/tag jumps.

Acceptance criteria:

- Core actions accessible without mouse.
- Shortcuts are discoverable and conflict-safe.

## Suggested Delivery Timeline

Resequenced after the 0.9.4 survey. Import/export moved to the front: it is what
makes the app trustworthy, and it is what lets people migrate *to* it.

- 0.9.5: Close the hardening phase - CI gates, remove the SEO scaffolding, add
  `/healthz`, and land a first test suite.
- 0.10: Export, then import. Duplicate resolution UX.
- 0.11: Search operators, richer filters, tag management.
- 0.12: Notes, metadata enrichment, broken-link monitoring.
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
