# HarborMarks Roadmap

This roadmap turns the current ideas into an execution plan with clear phases, outcomes, and acceptance criteria.

## Product Goals

- Make saved links easy to find and trust over time.
- Reduce friction for organizing large bookmark collections.
- Improve portability and ownership of user data.

## Prioritization Framework

Each item is prioritized by:

- User impact: how much value users get day-to-day.
- Effort: estimated implementation complexity in this codebase.
- Risk reduction: how much it prevents data or UX issues later.

## Phase 1: Core Reliability and Retrieval (High Impact, Low-Medium Effort)

### 1) Duplicate Detection

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

Why:

- Keeps important references visible.

Scope:

- Add isPinned field and pin/unpin action.
- Sort pinned first in selected views.

Acceptance criteria:

- Pinned cards stay on top within active filter context.

## Phase 3: Content Quality and Trust (Medium-High Impact, Medium Effort)

### 7) Broken Link Monitoring

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

Why:

- Power users benefit from fast navigation and capture.

Scope:

- Keyboard shortcuts for add dialog, search focus, and card actions.
- Optional command palette for quick filter/tag jumps.

Acceptance criteria:

- Core actions accessible without mouse.
- Shortcuts are discoverable and conflict-safe.

## Suggested Delivery Timeline

- Week 1: Duplicate detection + enhanced filters/search operators.
- Week 2: Tag management + bulk actions.
- Week 3: Broken link monitoring + notes/highlights.
- Week 4: Import/export + keyboard workflows.

## Engineering Notes

- Keep all new filters URL-driven for persistence and sharing.
- Reuse existing API patterns under pages/api/bookmarks for consistency.
- Extend BookmarkCardData incrementally to avoid large breaking changes.
- Add migration-safe schema updates (ADD COLUMN IF NOT EXISTS style as used now).

## Definition of Done per Feature

- API implemented with validation and error responses.
- UI integrated in dashboard/sidebar/dialog flows.
- Typecheck passes.
- Basic happy-path and error-path manual tests documented in PR.
