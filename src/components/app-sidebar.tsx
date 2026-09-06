import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"

import Logo from "@/assets/harborMark.svg"
import { CreateBookmarkDialog } from "@/components/dialog/CreateBookmarkDialog"
import { LatestChangesDialog } from "@/components/dialog/LatestChangesDialog"
import { NavUser, type SidebarUser } from "@/components/ui/NavUser"
import type { BookmarkCardData } from "@/lib/bookmark-types"
import { latestChanges } from "@/lib/changelog"
import { tagHue } from "@/lib/tag-color"
import {
  BookmarkIcon,
  HeartStraightIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react"

type SidebarTagSummary = {
  tag: string
  count: number
}

// A tiny store over the current route. Sidebar links write the route they are
// navigating to before the view transition completes, so the active item updates
// on click rather than after the swap; the router events then clear that guess
// and fall back to the real location.
const routeListeners = new Set<() => void>()
let optimisticRoute: string | null = null

function notifyRouteListeners() {
  for (const listener of routeListeners) {
    listener()
  }
}

function clearOptimisticRoute() {
  optimisticRoute = null
  notifyRouteListeners()
}

function setOptimisticRoute(route: string) {
  optimisticRoute = route
  notifyRouteListeners()
}

function subscribeToRoute(onChange: () => void) {
  routeListeners.add(onChange)

  if (routeListeners.size === 1) {
    document.addEventListener("astro:after-swap", clearOptimisticRoute)
    document.addEventListener("astro:page-load", clearOptimisticRoute)
    window.addEventListener("popstate", clearOptimisticRoute)
  }

  return () => {
    routeListeners.delete(onChange)

    if (routeListeners.size === 0) {
      document.removeEventListener("astro:after-swap", clearOptimisticRoute)
      document.removeEventListener("astro:page-load", clearOptimisticRoute)
      window.removeEventListener("popstate", clearOptimisticRoute)
    }
  }
}

function getRouteSnapshot() {
  return (
    optimisticRoute ?? `${window.location.pathname}${window.location.search}`
  )
}

function getServerRouteSnapshot() {
  return ""
}

export function AppSidebar({
  currentUser,
  onBookmarkSaved,
  preselectedTags,
  defaultFavorite,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  currentUser?: SidebarUser | null
  onBookmarkSaved?: (bookmark: BookmarkCardData) => void
  preselectedTags?: string[]
  defaultFavorite?: boolean
}) {
  const [tags, setTags] = React.useState<SidebarTagSummary[]>([])
  const [isLoadingTags, setIsLoadingTags] = React.useState(true)
  // Ref to the "Save a link" trigger so the `N` shortcut can open the same
  // create-mode dialog through the regular DialogTrigger click path.
  const saveTriggerRef = React.useRef<HTMLButtonElement>(null)

  // Dashboard shortcut: `N` opens the "Save a link" dialog. The sidebar only
  // renders inside the dashboard, so this listener is inherently
  // dashboard-scoped. It ignores keystrokes with modifiers, keystrokes while
  // typing, and keystrokes while another dialog/menu is already open.
  React.useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.defaultPrevented) {
        return
      }

      if (event.key.toLowerCase() !== "n") {
        return
      }

      // Allow Shift (needed for uppercase `N`); ignore real modifiers.
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return
      }

      const target = event.target as HTMLElement | null

      if (
        target?.closest(
          "input, textarea, select, [contenteditable], [role='dialog'], [role='alertdialog'], [cmdk-root], [data-cmdk-root]"
        ) ||
        target?.isContentEditable
      ) {
        return
      }

      // Another modal/dialog, menu, popover, or command palette is open.
      if (
        document.querySelector(
          "[role='dialog'][data-state='open'], [role='alertdialog'][data-state='open'], [role='menu'][data-state='open'], [data-state='open'][role='listbox'], [cmdk-root], [data-cmdk-root]"
        )
      ) {
        return
      }

      event.preventDefault()
      saveTriggerRef.current?.click()
    }

    window.addEventListener("keydown", handleKeydown)

    return () => {
      window.removeEventListener("keydown", handleKeydown)
    }
  }, [])

  // The URL is an external store: subscribe to it instead of copying it into
  // state from an effect. The server snapshot is empty so the first client
  // render matches the server-rendered markup.
  const route = React.useSyncExternalStore(
    subscribeToRoute,
    getRouteSnapshot,
    getServerRouteSnapshot
  )
  const [pathname, search = ""] = route.split("?")
  const activeTag =
    pathname === "/tag"
      ? new URLSearchParams(search).get("tag")?.trim() || null
      : null

  React.useEffect(() => {
    const abortController = new AbortController()

    async function loadTags() {
      setIsLoadingTags(true)

      try {
        const response = await fetch("/api/bookmarks/tags", {
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(`Failed to load tags (${response.status})`)
        }

        const payload = (await response.json()) as {
          data?: SidebarTagSummary[]
        }

        setTags(
          (payload.data ?? []).filter(
            (item): item is SidebarTagSummary =>
              typeof item?.tag === "string" && typeof item?.count === "number"
          )
        )
      } catch (error) {
        if (abortController.signal.aborted) {
          return
        }

        console.error(error)
        setTags([])
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoadingTags(false)
        }
      }
    }

    void loadTags()

    const handleTagsChanged = () => {
      void loadTags()
    }

    window.addEventListener("harbormarks:tags-changed", handleTagsChanged)

    return () => {
      abortController.abort()
      window.removeEventListener("harbormarks:tags-changed", handleTagsChanged)
    }
  }, [])

  const navigationGroups = React.useMemo(() => {
    return [
      {
        title: "Library",
        items: [
          {
            title: "All Bookmarks",
            url: "/",
            icon: <BookmarkIcon className="size-4" />,
          },
          {
            title: "Favorites",
            url: "/favorites",
            icon: <HeartStraightIcon className="size-4" />,
          },
          {
            title: "Trash",
            url: "/trash",
            icon: <TrashIcon className="size-4" />,
          },
        ],
      },
    ]
  }, [])

  const version = latestChanges[0]?.version ?? ""

  return (
    <Sidebar {...props}>
      <SidebarHeader className="gap-3">
        <div className="flex h-12 items-center gap-2">
          <img src={Logo.src} alt="HarborMarks logo" className="h-6 w-6" />
          <span className="text-lg font-bold">
            Harbor<span className="text-primary">Marks</span>
          </span>
          {version ? <LatestChangesDialog version={version} /> : null}
        </div>
        <CreateBookmarkDialog
          onSaved={onBookmarkSaved}
          preselectedTags={preselectedTags}
          defaultFavorite={defaultFavorite}
          trigger={
            <Button
              ref={saveTriggerRef}
              className="w-full justify-between font-medium"
              size="sidebar"
              title="Save a link (N)"
            >
              <span className="flex items-center gap-2">
                <PlusIcon className="size-4" weight="bold" />
                Save a link
              </span>
              <kbd className="rounded border border-white/25 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/80">
                N
              </kbd>
            </Button>
          }
        />
      </SidebarHeader>
      <SidebarContent>
        {/* We create a SidebarGroup for each parent. */}
        {navigationGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url}
                      size="lg"
                    >
                      <a
                        href={item.url}
                        onClick={() => {
                          setOptimisticRoute(item.url)
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              pathname === item.url ? "text-primary" : ""
                            }
                          >
                            {item?.icon}
                          </span>{" "}
                          {item.title}
                        </div>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        <SidebarGroup>
          <SidebarGroupLabel>Tags</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {isLoadingTags
                ? Array.from({ length: 4 }).map((_, index) => (
                    <SidebarMenuItem key={`tag-loading-${index}`}>
                      <SidebarMenuButton size="sm" disabled>
                        <div className="flex w-full items-center justify-between gap-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-6" />
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                : null}
              {tags.map((tag) => (
                <SidebarMenuItem key={tag.tag}>
                  <SidebarMenuButton
                    asChild
                    size="sm"
                    isActive={
                      activeTag?.toLowerCase() === tag.tag.toLowerCase()
                    }
                  >
                    <a
                      href={`/tag?tag=${encodeURIComponent(tag.tag)}`}
                      onClick={() => {
                        setOptimisticRoute(
                          `/tag?tag=${encodeURIComponent(tag.tag)}`
                        )
                      }}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="tag-dot"
                            style={
                              { "--h": tagHue(tag.tag) } as React.CSSProperties
                            }
                          />
                          <span className="truncate">{tag.tag}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {tag.count}
                        </span>
                      </div>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {!isLoadingTags && tags.length === 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton size="lg" disabled>
                    No tags yet
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {currentUser ? (
        <SidebarFooter>
          <NavUser user={currentUser} />
        </SidebarFooter>
      ) : null}
      <SidebarRail />
    </Sidebar>
  )
}
