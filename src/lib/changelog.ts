export type ChangelogEntry = {
  version: string
  date: string
  changes: string[]
}

export const latestChanges: ChangelogEntry[] = [
  {
    version: "v0.9.4",
    date: "2026-08-31",
    changes: [
      "Bookmarks in Trash can now be deleted permanently, so Trash is a decision instead of a one-way archive.",
      "Search now runs against an indexed full-text column instead of rebuilding the index on every query.",
      "Fixed the sidebar tag list failing to load on databases upgraded from an earlier release.",
      "Fixed favicons and preview images being dropped when a site serves them without a content type.",
      "Upgrades from older releases now convert existing tags instead of discarding them.",
      "Fixed several interface state bugs that could cause extra renders in the sidebar, bookmark cards, and the add/edit dialog.",
    ],
  },
  {
    version: "v0.9.3",
    date: "2026-08-30",
    changes: [
      "Proxied and cached bookmark favicons and preview images locally to avoid hotlinking on dashboard load.",
      "Fixed tag navigation and dashboard route syncing for Astro client-side swaps.",
      "Removed stale SESSION_SECRET documentation and aligned the release metadata.",
    ],
  },
  {
    version: "v0.9.1",
    date: "2026-07-28",
    changes: [
      "Refined the current bookmark and sidebar workflows for the 0.9.1 release.",
      "Kept the app aligned with the latest accessibility and interaction polish.",
      "Updated the changelog to reflect the current version metadata.",
    ],
  },
  {
    version: "v0.9.0",
    date: "2026-03-21",
    changes: [
      "Added a sidebar button to view latest product changes in a modal.",
      "Improved bookmark editing flow with clearer save and reset actions.",
      "Expanded API error messaging for authentication and bookmark endpoints.",
      "In Chrome, you can use a Summarize AI button to summarize the content of a bookmark. This uses a browser AI (Free). This feature not always works, depends on the content of the page and the browser's AI capabilities.",
    ],
  },
  {
    version: "v0.8.2",
    date: "2026-03-12",
    changes: [
      "Refined tag navigation state syncing after Astro page transitions.",
      "Improved sidebar loading placeholders for bookmark tags.",
      "Updated dialog interactions to better match mobile behavior.",
    ],
  },
  {
    version: "v0.8.0",
    date: "2026-03-01",
    changes: [
      "Introduced favorites filtering and quick-access navigation.",
      "Added admin user controls for activation and account management.",
      "Improved bookmark metadata extraction and fallback handling.",
    ],
  },
]
