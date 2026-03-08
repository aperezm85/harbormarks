import { useEffect, useRef, useState } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import type { BookmarkCardData } from "@/lib/bookmarks"

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

export const DashboardLayout = ({
  bookmarks,
}: {
  bookmarks: BookmarkCardData[]
}) => {
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [visibleBookmarks, setVisibleBookmarks] =
    useState<BookmarkCardData[]>(bookmarks)
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
  }, [debouncedSearch])

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
              Searching...
            </span>
          )}
          <CreateBookmarkDialog />
          <Separator orientation="vertical" className="mr-2 h-full" />
          <ModeToggle />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="min-h-screen flex-1 rounded-xl bg-muted/50 md:min-h-min">
            {hasActiveSearch && (
              <div className="px-4 pt-4 text-sm font-medium text-muted-foreground">
                Looking at results for "{debouncedSearch}".
              </div>
            )}
            <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
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
