// Shared helpers for keeping the dashboard's search text and index view in the
// URL (`/?view=unread&q=tag%3Arust`), so a refresh, a shared link, and the back
// button all land on the same results. Pure and DOM-free: the server pages and
// the client island both use it.

import type { BookmarkView } from "@/lib/bookmark-types"

export const MAX_QUERY_LENGTH = 200

export type IndexView = Extract<
  BookmarkView,
  "recent" | "unread" | "mostVisited" | "unorganized"
>

export function readQueryParam(params: URLSearchParams): string {
  return (params.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH)
}

// Sets or removes `q` on a URL in place. An empty query removes the parameter
// so the clean URL (`/`) is restored.
export function writeQueryParam(url: URL, query: string): void {
  const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH)

  if (trimmed) {
    url.searchParams.set("q", trimmed)
  } else {
    url.searchParams.delete("q")
  }
}

export function parseIndexView(rawValue: string | null): IndexView {
  if (
    rawValue === "unread" ||
    rawValue === "mostVisited" ||
    rawValue === "unorganized"
  ) {
    return rawValue
  }

  return "recent"
}

// Builds the home-page path for a view plus optional search text.
export function indexPath(view: IndexView, query: string): string {
  const params = new URLSearchParams()

  if (view !== "recent") {
    params.set("view", view)
  }

  const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH)
  if (trimmed) {
    params.set("q", trimmed)
  }

  const search = params.toString()
  return search ? `/?${search}` : "/"
}
