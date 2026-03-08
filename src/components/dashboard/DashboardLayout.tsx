import { useEffect, useRef, useState } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import type { BookmarkCardData, BookmarkView } from "@/lib/bookmarks"

import { CreateBookmarkDialog } from "@/components/dialog/CreateBookmarkDialog"
import { HarborCard } from "@/components/ui/HarborCard"
import { ModeToggle } from "@/components/ui/ModeToggle"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInput,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const DashboardLayout = ({
  bookmarks,
}: {
  bookmarks: BookmarkCardData[]
}) => {
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [visibleBookmarks, setVisibleBookmarks] =
    useState<BookmarkCardData[]>(bookmarks)
  const [activeView, setActiveView] = useState<BookmarkView>("recent")
  const [isRefreshingBookmarks, setIsRefreshingBookmarks] = useState(false)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 300)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [searchInput])

  useEffect(() => {
    const abortController = new AbortController()
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    const query = new URLSearchParams()

    if (debouncedSearch) {
      query.set("q", debouncedSearch)
    } else {
      query.set("view", activeView)
    }

    async function refreshBookmarks() {
      setIsRefreshingBookmarks(true)

      try {
        const response = await fetch(`/api/bookmarks?${query.toString()}`, {
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(`Failed to load bookmarks (${response.status})`)
        }

        const payload = (await response.json()) as {
          data?: BookmarkCardData[]
        }

        setVisibleBookmarks(payload.data ?? [])
      } catch (error) {
        if (abortController.signal.aborted) {
          return
        }

        console.error(error)
      } finally {
        if (requestId === requestIdRef.current) {
          setIsRefreshingBookmarks(false)
        }
      }
    }

    void refreshBookmarks()

    return () => {
      abortController.abort()
    }
  }, [activeView, debouncedSearch])

  const hasActiveSearch = debouncedSearch.length > 0

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
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
          <CreateBookmarkDialog />
          <Separator orientation="vertical" className="mr-2 h-full" />
          <ModeToggle />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="min-h-screen flex-1 rounded-xl bg-muted/50 md:min-h-min">
            <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
              {hasActiveSearch ? (
                <div className="text-md pt-4 font-medium text-muted-foreground">
                  Looking at results for "{debouncedSearch}".
                </div>
              ) : (
                <>
                  <div className="col-span-full flex flex-wrap gap-2">
                    <Tabs defaultValue={activeView} className="w-auto">
                      <TabsList variant="line">
                        <TabsTrigger
                          value="recent"
                          onClick={() => setActiveView("recent")}
                        >
                          Recent
                        </TabsTrigger>
                        <TabsTrigger
                          value="mostVisited"
                          onClick={() => setActiveView("mostVisited")}
                        >
                          Most visited
                        </TabsTrigger>
                        <TabsTrigger
                          value="unorganized"
                          onClick={() => setActiveView("unorganized")}
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
                <HarborCard key={bookmark.id} {...bookmark} />
              ))}
              {visibleBookmarks.length === 0 && (
                <div className="col-span-full rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  {hasActiveSearch
                    ? `Your harbor doesn't contain any results for "${debouncedSearch}".`
                    : "No bookmarks yet. Add your first bookmark to start building your harbor."}
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
