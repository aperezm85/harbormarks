import { useEffect, useRef, useState } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  DEFAULT_BOOKMARK_PAGE_SIZE,
  type BookmarkCardData,
  type BookmarkView,
} from "@/lib/bookmark-types"
import {
  parseBookmarkQuery,
  removeOperatorFromQuery,
} from "@/lib/bookmark-query"

import { DashboardTopBar } from "@/components/dashboard/DashboardTopBar"
import { DashboardSubBar } from "@/components/dashboard/DashboardSubBar"
import { AppErrorBoundary } from "@/components/ui/AppErrorBoundary"
import { Button } from "@/components/ui/button"
import { HarborCard } from "@/components/ui/HarborCard"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

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
  view?: "recent" | "mostVisited" | "unorganized" | "trash"
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
  const [isRefreshingBookmarks, setIsRefreshingBookmarks] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [page, setPage] = useState(1)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const requestIdRef = useRef(0)
  const skipInitialRefreshRef = useRef(true)

   // A successful import posts this event; reset to page 1 and re-fetch so the
   // newly imported bookmarks appear without a full page reload.
  useEffect(() => {
    function handleBookmarksChanged() {
      setPage(1)
      setRefreshTrigger((current) => current + 1)
     }

    window.addEventListener("harbormarks:bookmarks-changed", handleBookmarksChanged)

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
              navigateTo("/")
            }}
            onNavigate={(path) => {
              setPage(1)
              setSearchInput("")
              setDebouncedSearch("")
              navigateTo(path)
            }}
            onRemoveOperator={(token) => {
              const next = removeOperatorFromQuery(searchInput, token)
              setPage(1)
              setSearchInput(next)
              setDebouncedSearch(next)
            }}
          />
          <div className="flex flex-1 flex-col p-4">
            <div className="min-h-screen flex-1 md:min-h-min">
              <div className="grid gap-4 p-4 [grid-template-columns:repeat(auto-fill,minmax(268px,1fr))]">
                {visibleBookmarks.map((bookmark) => (
                  <HarborCard
                    key={bookmark.id}
                    {...bookmark}
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
                  <div className="col-span-full flex justify-center pt-2 pb-2">
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
                  <div className="col-span-full rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
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
