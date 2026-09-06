import { useEffect, useState } from "react"

import type {
  BookmarkView,
  BookmarkViewCounts,
} from "@/lib/bookmark-types"
import type { BookmarkQueryOperator } from "@/lib/bookmark-query"
import { SearchOperatorChips } from "@/components/dashboard/SearchOperatorChips"
import { cn } from "@/lib/utils"

// The dashboard sub bar: a sticky row under the top bar with the current view
// title + live count and the view chips (All / Most visited / Unorganized /
// Favorites / Trash). It replaces the old in-content tabs and per-view
// headings. Index chips change the in-memory view; Favorites/Trash navigate.
// When a search is active the parsed operator chips are shown below the row.
type ViewChipKey =
  | "recent"
  | "unread"
  | "mostVisited"
  | "unorganized"
  | "favorites"
  | "trash"

const VIEW_TITLE: Record<BookmarkView, string> = {
  recent: "Recent",
  unread: "Unread",
  mostVisited: "Most visited",
  unorganized: "Unorganized",
  trash: "Trash",
}

const CHIP_DEFS: { key: ViewChipKey; label: string }[] = [
  { key: "recent", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "mostVisited", label: "Most visited" },
  { key: "unorganized", label: "Unorganized" },
  { key: "favorites", label: "Favorites" },
  { key: "trash", label: "Trash" },
]

export const DashboardSubBar = ({
  activeView,
  routeTagFilter,
  routeOnlyFavorites,
  routeTrashOnly,
  hasActiveSearch,
  debouncedSearch,
  count,
  queryOperators,
  onIndexViewChange,
  onNavigate,
  onRemoveOperator,
}: {
  activeView: BookmarkView
  routeTagFilter?: string
  routeOnlyFavorites: boolean
  routeTrashOnly: boolean
  hasActiveSearch: boolean
  debouncedSearch: string
  count: number
  queryOperators: BookmarkQueryOperator[]
  onIndexViewChange: (view: "recent" | "unread" | "mostVisited" | "unorganized") => void
  onNavigate: (path: string) => void
  onRemoveOperator: (token: string) => void
}) => {
  // Title follows the same priority the content used to use: search, then the
  // route views, then the index view.
  const title = hasActiveSearch
    ? `Results for “${debouncedSearch}”`
    : routeOnlyFavorites
      ? "Favorites"
      : routeTagFilter
        ? `Tag: ${routeTagFilter}`
        : routeTrashOnly
          ? "Trash"
          : VIEW_TITLE[activeView]

  // The active chip reflects the view you are in, not the search. A tag filter
  // or an active search leaves no chip highlighted.
  const activeChip: ViewChipKey | null = hasActiveSearch
    ? null
    : routeOnlyFavorites
      ? "favorites"
      : routeTagFilter
        ? null
        : routeTrashOnly
          ? "trash"
          : activeView

  const [viewCounts, setViewCounts] = useState<BookmarkViewCounts | null>(null)

  // Per-chip totals come from a dedicated counts endpoint so the subbar can
  // refresh them without re-fetching the bookmark rows. They are decorative: a
  // failed fetch simply hides the numbers rather than breaking the chips.
  useEffect(() => {
    let cancelled = false

    const fetchCounts = async () => {
      try {
        const response = await fetch("/api/bookmarks/counts")
        if (!response.ok) {
          return
        }
        const payload = (await response.json()) as {
          data?: BookmarkViewCounts
        }
        if (!cancelled && payload.data) {
          setViewCounts(payload.data)
        }
      } catch {
        // Ignore: counts are non-critical.
      }
    }

    void fetchCounts()

    const refresh = () => {
      void fetchCounts()
    }
    window.addEventListener("harbormarks:bookmarks-changed", refresh)
    window.addEventListener("harbormarks:tags-changed", refresh)
    return () => {
      cancelled = true
      window.removeEventListener("harbormarks:bookmarks-changed", refresh)
      window.removeEventListener("harbormarks:tags-changed", refresh)
    }
  }, [])

  const handleChipClick = (key: ViewChipKey) => {
    if (key === "favorites") {
      onNavigate("/favorites")
    } else if (key === "trash") {
      onNavigate("/trash")
    } else {
      onIndexViewChange(key)
    }
  }

  return (
    <div className="sticky top-14 z-20 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-[19px] font-bold tracking-tight">{title}</h1>
          <span className="font-mono text-[11.5px] text-muted-foreground">
            {count}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {CHIP_DEFS.map((chip) => {
            const isActive = activeChip === chip.key
            const chipCount = viewCounts ? viewCounts[chip.key] : null
            return (
              <button
                key={chip.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => handleChipClick(chip.key)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
                  isActive
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                )}
              >
                {chip.label}
                {chipCount !== null ? (
                  <span
                    className={cn(
                      "font-mono text-[11px] tabular-nums",
                      isActive ? "opacity-70" : "opacity-60"
                    )}
                  >
                    {chipCount}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>
      {hasActiveSearch ? (
        <div className="px-4 pb-2.5">
          <SearchOperatorChips
            operators={queryOperators}
            onRemove={onRemoveOperator}
          />
        </div>
      ) : null}
    </div>
  )
}
