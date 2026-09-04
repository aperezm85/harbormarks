export type ChangelogEntry = {
  version: string
  date: string
  changes: string[]
}

export const latestChanges: ChangelogEntry[] = [
  {
    version: "v0.9.7",
    date: "2026-09-03",
    changes: [
      "Search now understands operators, so you can filter by tag, site, favorite status, whether a preview image exists, and save date — alongside free-text search.",
      "Combine operators to narrow results precisely (for example tag:rust site:github.com); the active operators appear as removable chips under the search box.",
      "The search box now shows a hint of the operators you can use.",
    ],
  },
  {
    version: "v0.9.6",
    date: "2026-09-03",
    changes: [
      "Bookmark cards now show the site name, and the edit dialog surfaces the author, publish date, language, and canonical URL when a page provides them.",
      "Metadata is read with a real HTML parser, so titles, descriptions, and images come through more reliably — including on pages that sit behind bot protection.",
      "Pages served in a non-UTF-8 encoding (for example Latin-1) now show their accents correctly instead of arriving as garbled text.",
    ],
  },
  {
    version: "v0.9.5",
    date: "2026-09-02",
    changes: [
      "Add bookmarks from a JSON or Netscape HTML file, via a new menu item in the sidebar account area, next to export.",
      "Links that already exist by URL are reconciled with your saved bookmark instead of duplicated.",
      "Fixed notifications (toasts) that were shifting the page content instead of floating over it.",
      "Brought the in-app changelog, README, and ROADMAP back in sync for the 0.9.5 release.",
    ],
  },
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
