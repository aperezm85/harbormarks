import { useEffect, useRef, useState } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  parseBookmarkQuery,
  removeOperatorFromQuery,
} from "@/lib/bookmark-query"
import {
  DEFAULT_BOOKMARK_PAGE_SIZE,
  type BookmarkCardData,
  type BookmarkView,
} from "@/lib/bookmark-types"
import {
  DEFAULT_CARD_VIEW,
  getStoredCardView,
  setStoredCardView,
  type CardViewMode,
} from "@/lib/card-view"
import { cn } from "@/lib/utils"

import { DashboardSubBar } from "@/components/dashboard/DashboardSubBar"
import { DashboardTopBar } from "@/components/dashboard/DashboardTopBar"
import { BulkActionBar } from "@/components/dashboard/BulkActionBar"
import { AppErrorBoundary } from "@/components/ui/AppErrorBoundary"
import { Button } from "@/components/ui/button"
import { HarborCard } from "@/components/ui/HarborCard"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { toast } from "sonner"

import type { BulkBookmarksAction } from "@/lib/bookmarks"

import { Toaster } from "@/components/ui/sonner"

export const DashboardLayout = ({
  bookmarks,
  tagFilter,
  onlyFavorites,
  view,
  currentUser,
  hasMore: initialHasMore = false,
}: {
  bookmarks: BookmarkCardData[]
  tagFilter?: string
  onlyFavorites?: boolean
  view?: "recent" | "unread" | "mostVisited" | "unorganized" | "trash"
  hasMore?: boolean
  currentUser?: {
    id: number
    email: string
    displayName: string | null
    avatarUrl: string
    role: "admin" | "user"
  } | null
}) => {
  const [routeTagFilter, setRouteTagFilter] = useState(tagFilter)
  const [routeOnlyFavorites, setRouteOnlyFavorites] = useState(onlyFavorites)
  const [routeTrashOnly, setRouteTrashOnly] = useState(view === "trash")
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [visibleBookmarks, setVisibleBookmarks] =
    useState<BookmarkCardData[]>(bookmarks)
  const [activeView, setActiveView] = useState<BookmarkView>(view ?? "recent")
  const [cardView, setCardView] = useState<CardViewMode>(DEFAULT_CARD_VIEW)
  // False until the stored view has been applied. The container stays
  // `invisible` (layout preserved, just not painted) until then, so a stored
  // list/compact choice never flashes the server-rendered grid first.
  const [isCardViewReady, setIsCardViewReady] = useState(false)
  const [isRefreshingBookmarks, setIsRefreshingBookmarks] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [page, setPage] = useState(1)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const requestIdRef = useRef(0)
  const skipInitialRefreshRef = useRef(true)
  // Story 11 bulk selection. A Set of bookmark ids (strings, matching
  // BookmarkCardData.id). Selection clears after an action and on view change.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkWorking, setIsBulkWorking] = useState(false)
  const lastSelectedIndexRef = useRef<number | null>(null)

  const selectionActive = selectedIds.size > 0

  const clearSelection = () => {
    lastSelectedIndexRef.current = null
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: string, index: number, shiftKey: boolean) => {
    const lastIndex = lastSelectedIndexRef.current

    if (shiftKey && lastIndex !== null && lastIndex !== index) {
      const [from, to] =
        lastIndex < index ? [lastIndex, index] : [index, lastIndex]
      const rangeIds = visibleBookmarks.slice(from, to + 1).map((b) => b.id)
      setSelectedIds((current) => new Set([...current, ...rangeIds]))
    } else {
      setSelectedIds((current) => {
        const next = new Set(current)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
    }
    lastSelectedIndexRef.current = index
  }

  const toggleSelectAllLoaded = () => {
    setSelectedIds((current) => {
      if (
        visibleBookmarks.length > 0 &&
        current.size >= visibleBookmarks.length &&
        visibleBookmarks.every((b) => current.has(b.id))
      ) {
        lastSelectedIndexRef.current = null
        return new Set()
      }

      lastSelectedIndexRef.current = null
      return new Set(visibleBookmarks.map((b) => b.id))
    })
  }

  // A successful import posts this event; reset to page 1 and re-fetch so the
  // newly imported bookmarks appear without a full page reload.
  // The stored card view is read in an effect (not the useState initializer)
  // so the server-rendered markup always matches the first client render and
  // the persisted choice hydrates right after without a mismatch.
  useEffect(() => {
    // Hydrating persisted UI state on mount: sanctioned set-state-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCardView(getStoredCardView())
    setIsCardViewReady(true)
  }, [])

  const handleCardViewChange = (next: CardViewMode) => {
    setCardView(next)
    setStoredCardView(next)
  }

  useEffect(() => {
    function handleBookmarksChanged() {
      setPage(1)
      setRefreshTrigger((current) => current + 1)
    }

    window.addEventListener(
      "harbormarks:bookmarks-changed",
      handleBookmarksChanged
    )

    return () => {
      window.removeEventListener(
        "harbormarks:bookmarks-changed",
        handleBookmarksChanged
      )
    }
  }, [])

  useEffect(() => {
    function syncRouteFilters() {
      const { pathname, search } = window.location
      const searchParams = new URLSearchParams(search)
      lastSelectedIndexRef.current = null
      setSelectedIds(new Set())

      if (pathname === "/tag") {
        const nextTag = searchParams.get("tag")?.trim() ?? ""
        setRouteTagFilter(nextTag || undefined)
        setRouteOnlyFavorites(false)
        setRouteTrashOnly(false)
        setPage(1)
        return
      }

      if (pathname === "/favorites") {
        setRouteTagFilter(undefined)
        setRouteOnlyFavorites(true)
        setRouteTrashOnly(false)
        setPage(1)
        return
      }

      if (pathname === "/trash") {
        setRouteTagFilter(undefined)
        setRouteOnlyFavorites(false)
        setRouteTrashOnly(true)
        setPage(1)
        return
      }

      setRouteTagFilter(undefined)
      setRouteOnlyFavorites(false)
      setRouteTrashOnly(false)
      setPage(1)
    }

    syncRouteFilters()

    document.addEventListener("astro:after-swap", syncRouteFilters)
    document.addEventListener("astro:page-load", syncRouteFilters)
    window.addEventListener("popstate", syncRouteFilters)

    return () => {
      document.removeEventListener("astro:after-swap", syncRouteFilters)
      document.removeEventListener("astro:page-load", syncRouteFilters)
      window.removeEventListener("popstate", syncRouteFilters)
    }
  }, [])

  const applyBookmarkUpdate = (updatedBookmark: BookmarkCardData) => {
    setVisibleBookmarks((current) => {
      const existingIndex = current.findIndex(
        (bookmark) => bookmark.id === updatedBookmark.id
      )

      if (existingIndex === -1) {
        return [updatedBookmark, ...current]
      }

      const next = [...current]
      next[existingIndex] = updatedBookmark
      return next
    })
    window.dispatchEvent(new CustomEvent("harbormarks:tags-changed"))
  }

  const incrementVisitCount = (id: string) => {
    setVisibleBookmarks((current) =>
      current.map((bookmark) =>
        bookmark.id === id
          ? { ...bookmark, visitCount: bookmark.visitCount + 1 }
          : bookmark
      )
    )
  }

  const decrementVisitCount = (id: string) => {
    setVisibleBookmarks((current) =>
      current.map((bookmark) =>
        bookmark.id === id
          ? {
              ...bookmark,
              visitCount: Math.max(0, bookmark.visitCount - 1),
            }
          : bookmark
      )
    )
  }

  const resetVisitCount = (id: string) => {
    setVisibleBookmarks((current) =>
      current.map((bookmark) =>
        bookmark.id === id ? { ...bookmark, visitCount: 0 } : bookmark
      )
    )
  }

  const setFavoriteState = (id: string, nextIsFavorite: boolean) => {
    setVisibleBookmarks((current) =>
      current.map((bookmark) =>
        bookmark.id === id
          ? { ...bookmark, isFavorite: nextIsFavorite }
          : bookmark
      )
    )
  }

  const removeBookmark = (bookmarkToRemove: BookmarkCardData) => {
    setVisibleBookmarks((current) =>
      current.filter((bookmark) => bookmark.id !== bookmarkToRemove.id)
    )
    window.dispatchEvent(new CustomEvent("harbormarks:tags-changed"))
  }

  const removeTrashBookmark = (bookmarkToRemove: BookmarkCardData) => {
    setVisibleBookmarks((current) =>
      current.filter((bookmark) => bookmark.id !== bookmarkToRemove.id)
    )
  }

  const restoreBookmark = (bookmarkToRestore: BookmarkCardData) => {
    setVisibleBookmarks((current) => {
      if (current.some((bookmark) => bookmark.id === bookmarkToRestore.id)) {
        return current
      }

      return [bookmarkToRestore, ...current]
    })
  }

  const handleBulkAction = (action: BulkBookmarksAction, tags?: string[]) => {
    if (selectedIds.size === 0 || isBulkWorking) {
      return
    }

    const ids = [...selectedIds]
    const numericIds = ids
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)

    if (numericIds.length === 0) {
      return
    }

    const snapshot = visibleBookmarks
    const selected = new Set(ids)
    const cleanTags = (tags ?? []).map((t) => t.trim()).filter(Boolean)

    // Optimistic update matching the single-card pattern in HarborCard.
    setVisibleBookmarks((current) => {
      switch (action) {
        case "delete":
          return current.filter((b) => !selected.has(b.id))
        case "favorite":
          return current.map((b) =>
            selected.has(b.id) ? { ...b, isFavorite: true } : b
          )
        case "unfavorite":
          return current.map((b) =>
            selected.has(b.id) ? { ...b, isFavorite: false } : b
          )
        case "archive":
          return current.map((b) =>
            selected.has(b.id) ? { ...b, status: "archived" } : b
          )
        case "unarchive":
          return current.map((b) =>
            selected.has(b.id) ? { ...b, status: "reading" } : b
          )
        case "add-tags":
          return current.map((b) => {
            if (!selected.has(b.id)) return b
            const merged = [...b.tags]
            for (const tag of cleanTags) {
              if (!merged.some((t) => t.toLowerCase() === tag.toLowerCase())) {
                merged.push(tag)
              }
            }
            return { ...b, tags: merged }
          })
        case "remove-tags": {
          const drop = new Set(cleanTags.map((t) => t.toLowerCase()))
          return current.map((b) =>
            selected.has(b.id)
              ? { ...b, tags: b.tags.filter((t) => !drop.has(t.toLowerCase())) }
              : b
          )
        }
      }
    })
    clearSelection()
    setIsBulkWorking(true)

    void fetch("/api/bookmarks/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: numericIds, action, tags: cleanTags }),
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as {
          data?: { affected?: number; requested?: number }
          error?: string
        } | null

        if (!response.ok) {
          throw new Error(payload?.error ?? "Bulk update failed")
        }

        const affected = payload?.data?.affected ?? numericIds.length
        const requested = payload?.data?.requested ?? numericIds.length

        if (action === "delete") {
          toast.success(
            affected === 1
              ? "Bookmark moved to Trash."
              : `${affected} bookmarks moved to Trash.`
          )
        } else if (affected < requested) {
          toast.success(
            `${affected} of ${requested} bookmarks updated (others were skipped).`
          )
        } else {
          toast.success(
            affected === 1 ? "Bookmark updated." : `${affected} bookmarks updated.`
          )
        }

        window.dispatchEvent(new CustomEvent("harbormarks:tags-changed"))
      })
      .catch(() => {
        setVisibleBookmarks(snapshot)
        toast.error("Bulk update failed. Changes were reverted.")
      })
      .finally(() => {
        setIsBulkWorking(false)
      })
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 300)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [searchInput])

  useEffect(() => {
    if (skipInitialRefreshRef.current) {
      skipInitialRefreshRef.current = false
      return
    }

    const abortController = new AbortController()
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    const query = new URLSearchParams()

    if (routeTrashOnly) {
      query.set("view", "trash")
    } else if (debouncedSearch) {
      query.set("q", debouncedSearch)
    } else if (!routeTagFilter && !routeOnlyFavorites) {
      query.set("view", activeView)
    }

    if (routeTagFilter) {
      query.set("tag", routeTagFilter)
    }

    if (routeOnlyFavorites) {
      query.set("favorites", "1")
    }

    query.set("page", String(page))
    query.set("pageSize", String(DEFAULT_BOOKMARK_PAGE_SIZE))

    async function refreshBookmarks() {
      setIsRefreshingBookmarks(true)
      setIsLoadingMore(page > 1)

      try {
        const response = await fetch(`/api/bookmarks?${query.toString()}`, {
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(`Failed to load bookmarks (${response.status})`)
        }

        const payload = (await response.json()) as {
          data?: BookmarkCardData[]
          hasMore?: boolean
        }

        setVisibleBookmarks((current) => {
          if (page === 1) {
            return payload.data ?? []
          }

          return [...current, ...(payload.data ?? [])]
        })
        setHasMore(Boolean(payload.hasMore))
      } catch (error) {
        if (abortController.signal.aborted) {
          return
        }

        console.error(error)
      } finally {
        if (requestId === requestIdRef.current) {
          setIsRefreshingBookmarks(false)
          setIsLoadingMore(false)
        }
      }
    }

    void refreshBookmarks()

    return () => {
      abortController.abort()
    }
  }, [
    activeView,
    debouncedSearch,
    page,
    routeTagFilter,
    routeOnlyFavorites,
    routeTrashOnly,
    refreshTrigger,
  ])

  // Story 8: derive the parsed operators from the debounced search at render
  // time (not in an effect) so the removable chips always reflect the active
  // query. Removal happens in an event handler, never in an effect.
  const queryOperators = parseBookmarkQuery(debouncedSearch).operators

  const hasActiveSearch = debouncedSearch.length > 0

  // Container classes per card density. Kept as a plain variable (not an
  // inline template literal) so prettier-plugin-tailwindcss can sort the
  // classes without touching the conditional `invisible` gate below.
  const densityClassName =
    cardView === "grid"
      ? "grid w-full min-w-0 gap-4 p-4 [grid-template-columns:repeat(auto-fill,minmax(268px,1fr))]"
      : cardView === "list"
        ? "flex w-full min-w-0 flex-col gap-2.5 p-4"
        : "flex w-full min-w-0 flex-col gap-px overflow-hidden p-4"

  // Client-side navigation that rides the app's ClientRouter: click a
  // transient link so the transition (and the route-sync effect) run without
  // a full page reload. Mirrors how the sidebar's <a href> links behave.
  const navigateTo = (path: string) => {
    const link = document.createElement("a")
    link.href = path
    link.style.display = "none"
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (
    <AppErrorBoundary>
      <SidebarProvider>
        <AppSidebar
          currentUser={currentUser ?? null}
          onBookmarkSaved={applyBookmarkUpdate}
          preselectedTags={routeTagFilter ? [routeTagFilter] : undefined}
          defaultFavorite={routeOnlyFavorites}
        />
        <SidebarInset>
          <DashboardTopBar
            searchInput={searchInput}
            onSearchChange={(value) => {
              setPage(1)
              setSearchInput(value)
            }}
            onSearchClear={() => {
              setPage(1)
              setSearchInput("")
              setDebouncedSearch("")
            }}
            isRefreshing={isRefreshingBookmarks}
            hasActiveSearch={hasActiveSearch}
            cardView={cardView}
            onCardViewChange={handleCardViewChange}
          />
          <DashboardSubBar
            activeView={activeView}
            routeTagFilter={routeTagFilter}
            routeOnlyFavorites={routeOnlyFavorites ?? false}
            routeTrashOnly={routeTrashOnly}
            hasActiveSearch={hasActiveSearch}
            debouncedSearch={debouncedSearch}
            count={visibleBookmarks.length}
            queryOperators={queryOperators}
            onIndexViewChange={(view) => {
              setPage(1)
              setSearchInput("")
              setDebouncedSearch("")
              setRouteOnlyFavorites(false)
              setRouteTrashOnly(false)
              setRouteTagFilter(undefined)
              setActiveView(view)
              clearSelection()
              navigateTo("/")
            }}
            onNavigate={(path) => {
              setPage(1)
              setSearchInput("")
              setDebouncedSearch("")
              clearSelection()
              navigateTo(path)
            }}
            onRemoveOperator={(token) => {
              const next = removeOperatorFromQuery(searchInput, token)
              setPage(1)
              setSearchInput(next)
              setDebouncedSearch(next)
            }}
          />
          <div className="flex min-w-0 flex-1 flex-col p-4">
            <BulkActionBar
              selectedCount={selectedIds.size}
              totalLoaded={visibleBookmarks.length}
              isWorking={isBulkWorking}
              onToggleSelectAll={toggleSelectAllLoaded}
              onClear={clearSelection}
              onAction={handleBulkAction}
            />
            <div className="min-h-screen min-w-0 flex-1 md:min-h-min">
              {/* `invisible` until the stored view is applied: it keeps the
              layout space reserved, so the cards appear at the right density
              with no layout jump (see isCardViewReady). */}
              <div
                className={cn(
                  densityClassName,
                  !isCardViewReady && "invisible"
                )}
              >
                {visibleBookmarks.map((bookmark, index) => (
                  <HarborCard
                    key={bookmark.id}
                    {...bookmark}
                    viewMode={cardView}
                    selected={selectedIds.has(bookmark.id)}
                    selectionActive={selectionActive}
                    onSelectToggle={(shiftKey) =>
                      toggleSelect(bookmark.id, index, shiftKey)
                    }
                    onSaved={applyBookmarkUpdate}
                    onVisit={() => incrementVisitCount(bookmark.id)}
                    onVisitRollback={() => decrementVisitCount(bookmark.id)}
                    onVisitReset={() => resetVisitCount(bookmark.id)}
                    onVisitResetRollback={(previousCount) =>
                      setVisibleBookmarks((current) =>
                        current.map((currentBookmark) =>
                          currentBookmark.id === bookmark.id
                            ? {
                                ...currentBookmark,
                                visitCount: previousCount,
                              }
                            : currentBookmark
                        )
                      )
                    }
                    onFavoriteToggle={(nextIsFavorite) =>
                      setFavoriteState(bookmark.id, nextIsFavorite)
                    }
                    onDeleted={removeBookmark}
                    onDeleteRollback={restoreBookmark}
                    onRestored={removeTrashBookmark}
                    onPurged={removeTrashBookmark}
                    isTrashItem={routeTrashOnly}
                  />
                ))}
                {hasMore ? (
                  <div className="flex w-full justify-center pt-2 pb-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setPage((current) => current + 1)}
                      disabled={isRefreshingBookmarks || isLoadingMore}
                    >
                      {isLoadingMore
                        ? "Loading more..."
                        : "Load more bookmarks"}
                    </Button>
                  </div>
                ) : null}
                {visibleBookmarks.length === 0 && (
                  <div className="w-full rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    {hasActiveSearch
                      ? `Your harbor doesn't contain any results for "${debouncedSearch}".`
                      : routeOnlyFavorites
                        ? "No favorite bookmarks yet. Mark a bookmark as favorite to see it here."
                        : routeTagFilter
                          ? `No bookmarks found with the tag "${routeTagFilter}".`
                          : "No bookmarks yet. Add your first bookmark to start building your harbor."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </SidebarInset>
        <Toaster position="top-center" />
      </SidebarProvider>
    </AppErrorBoundary>
  )
}
