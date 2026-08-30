import { useEffect, useRef, useState } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  DEFAULT_BOOKMARK_PAGE_SIZE,
  type BookmarkCardData,
  type BookmarkView,
} from "@/lib/bookmark-types"

import { CreateBookmarkDialog } from "@/components/dialog/CreateBookmarkDialog"
import { AppErrorBoundary } from "@/components/ui/AppErrorBoundary"
import { Button } from "@/components/ui/button"
import { HarborCard } from "@/components/ui/HarborCard"
import { ModeToggle } from "@/components/ui/ModeToggle"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInput,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"

import { Toaster } from "@/components/ui/sonner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const DashboardTopBar = ({
  searchInput,
  setSearchInput,
  setDebouncedSearch,
  isRefreshingBookmarks,
  hasActiveSearch,
  onBookmarkSaved,
  preselectedTags,
  defaultFavorite,
}: {
  searchInput: string
  setSearchInput: (value: string) => void
  setDebouncedSearch: (value: string) => void
  isRefreshingBookmarks: boolean
  hasActiveSearch: boolean
  onBookmarkSaved: (bookmark: BookmarkCardData) => void
  preselectedTags?: string[]
  defaultFavorite?: boolean
}) => {
  const { open, openMobile, isMobile } = useSidebar()
  const isSidebarOpen = isMobile ? openMobile : open

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <a
        href="/"
        aria-hidden={isSidebarOpen}
        className={[
          "hidden overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out sm:block",
          isSidebarOpen
            ? "pointer-events-none max-w-0 -translate-x-2 opacity-0"
            : "max-w-52 shrink-0 translate-x-0 opacity-100",
        ].join(" ")}
      >
        <span className="text-lg font-semibold">
          Harbor<span className="text-primary">Marks</span>
        </span>
      </a>
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-full" />
      <SidebarInput
        id="search"
        placeholder="Search your harbor..."
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        onClear={() => {
          setSearchInput("")
          setDebouncedSearch("")
        }}
      />
      {isRefreshingBookmarks && (
        <span
          className="text-xs text-muted-foreground"
          aria-live="polite"
          role="status"
        >
          {hasActiveSearch ? "Searching..." : "Refreshing..."}
        </span>
      )}
      <CreateBookmarkDialog
        onSaved={onBookmarkSaved}
        preselectedTags={preselectedTags}
        defaultFavorite={defaultFavorite}
      />
      <Separator orientation="vertical" className="mr-2 h-full" />
      <ModeToggle />
    </header>
  )
}

export const DashboardLayout = ({
  bookmarks,
  tagFilter,
  onlyFavorites,
  currentUser,
  hasMore: initialHasMore = false,
}: {
  bookmarks: BookmarkCardData[]
  tagFilter?: string
  onlyFavorites?: boolean
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
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [visibleBookmarks, setVisibleBookmarks] =
    useState<BookmarkCardData[]>(bookmarks)
  const [activeView, setActiveView] = useState<BookmarkView>("recent")
  const [isRefreshingBookmarks, setIsRefreshingBookmarks] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [page, setPage] = useState(1)
  const requestIdRef = useRef(0)
  const skipInitialRefreshRef = useRef(true)

  useEffect(() => {
    function syncRouteFilters() {
      const { pathname, search } = window.location
      const searchParams = new URLSearchParams(search)

      if (pathname === "/tag") {
        const nextTag = searchParams.get("tag")?.trim() ?? ""
        setRouteTagFilter(nextTag || undefined)
        setRouteOnlyFavorites(false)
        setPage(1)
        return
      }

      if (pathname === "/favorites") {
        setRouteTagFilter(undefined)
        setRouteOnlyFavorites(true)
        setPage(1)
        return
      }

      setRouteTagFilter(undefined)
      setRouteOnlyFavorites(false)
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

    if (debouncedSearch) {
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
  }, [activeView, debouncedSearch, page, routeTagFilter, routeOnlyFavorites])

  const hasActiveSearch = debouncedSearch.length > 0

  return (
    <AppErrorBoundary>
      <SidebarProvider>
        <AppSidebar currentUser={currentUser ?? null} />
        <SidebarInset>
          <DashboardTopBar
            searchInput={searchInput}
            setSearchInput={(value) => {
              setPage(1)
              setSearchInput(value)
            }}
            setDebouncedSearch={(value) => {
              setPage(1)
              setDebouncedSearch(value)
            }}
            isRefreshingBookmarks={isRefreshingBookmarks}
            hasActiveSearch={hasActiveSearch}
            onBookmarkSaved={applyBookmarkUpdate}
            preselectedTags={routeTagFilter ? [routeTagFilter] : undefined}
            defaultFavorite={routeOnlyFavorites}
          />
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="min-h-screen flex-1 rounded-xl bg-muted/50 md:min-h-min">
              <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {hasActiveSearch ? (
                  <div className="text-md pt-4 font-medium text-muted-foreground">
                    Looking at results for "{debouncedSearch}".
                  </div>
                ) : routeOnlyFavorites ? (
                  <>
                    <h2 className="col-span-full text-2xl font-medium text-muted-foreground">
                      Favorite Bookmarks
                    </h2>
                    <h3 className="col-span-full text-sm font-medium text-muted-foreground">
                      {visibleBookmarks.length} favorite links
                    </h3>
                  </>
                ) : routeTagFilter ? (
                  <>
                    <h2 className="col-span-full text-2xl font-medium text-muted-foreground">
                      Tag: {routeTagFilter}
                    </h2>
                    <h3 className="col-span-full text-sm font-medium text-muted-foreground">
                      {visibleBookmarks.length} links with this tag
                    </h3>
                  </>
                ) : (
                  <>
                    <div className="col-span-full flex flex-wrap gap-2">
                      <Tabs defaultValue={activeView} className="w-auto">
                        <TabsList variant="line">
                          <TabsTrigger
                            value="recent"
                            onClick={() => {
                              setPage(1)
                              setActiveView("recent")
                            }}
                          >
                            Recent
                          </TabsTrigger>
                          <TabsTrigger
                            value="mostVisited"
                            onClick={() => {
                              setPage(1)
                              setActiveView("mostVisited")
                            }}
                          >
                            Most visited
                          </TabsTrigger>
                          <TabsTrigger
                            value="unorganized"
                            onClick={() => {
                              setPage(1)
                              setActiveView("unorganized")
                            }}
                          >
                            Unorganized
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    <h2 className="col-span-full text-2xl font-medium text-muted-foreground">
                      {activeView === "recent" && "Recent Bookmarks"}
                      {activeView === "mostVisited" && "Most Visited Bookmarks"}
                      {activeView === "unorganized" && "Unorganized Bookmarks"}
                    </h2>
                    <h3 className="col-span-full text-sm font-medium text-muted-foreground">
                      {activeView === "recent" &&
                        `${visibleBookmarks.length} links sorted by creation date`}
                      {activeView === "mostVisited" &&
                        `${visibleBookmarks.length} links sorted by total visits`}
                      {activeView === "unorganized" &&
                        `${visibleBookmarks.length} links without tags`}
                    </h3>
                  </>
                )}

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
