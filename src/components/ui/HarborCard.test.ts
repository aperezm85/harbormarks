import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { HarborCard } from "./HarborCard"

describe("HarborCard", () => {
  it("uses a responsive action rail in list view to avoid overflow", () => {
    const html = renderToStaticMarkup(
      React.createElement(HarborCard, {
        id: "bookmark-1",
        url: "https://example.com",
        title: "Example bookmark",
        description: "A bookmark used to validate the list layout.",
        favicon: "https://example.com/favicon.ico",
        previewImage: null,
        tags: ["demo", "test"],
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: null,
        lastVisitedAt: null,
        isFavorite: false,
        visitCount: 3,
        siteName: "Example",
        author: null,
        publishedAt: null,
        language: null,
        canonicalUrl: null,
        note: null,
        status: "unread",
        linkHealth: "unknown",
        viewMode: "list",
      })
    )

    // Narrow base width for mobile + wider rail on sm+ screens.
    expect(html).toContain("min-w-0")
    expect(html).toContain("w-[132px]")
    expect(html).toContain("sm:w-[180px]")
  })

  it("renders the broken badge without a status dot", () => {
    const html = renderToStaticMarkup(
      React.createElement(HarborCard, {
        id: "bookmark-2",
        url: "https://example.com/broken",
        title: "Broken bookmark",
        description: "A bookmark with a dead link.",
        favicon: "https://example.com/favicon.ico",
        previewImage: null,
        tags: [],
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: null,
        lastVisitedAt: null,
        isFavorite: false,
        visitCount: 0,
        siteName: "Example",
        author: null,
        publishedAt: null,
        language: null,
        canonicalUrl: null,
        note: null,
        status: "reading",
        linkHealth: "broken",
        viewMode: "list",
      })
    )

    expect(html).toContain("Broken")
    expect(html).not.toContain("rounded-full bg-current")
  })
})
