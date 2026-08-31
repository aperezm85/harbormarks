import * as React from "react"

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
import { LatestChangesDialog } from "@/components/dialog/LatestChangesDialog"
import { NavUser, type SidebarUser } from "@/components/ui/NavUser"
import {
  BookmarkIcon,
  HashIcon,
  HeartStraightIcon,
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
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  currentUser?: SidebarUser | null
}) {
  const [tags, setTags] = React.useState<SidebarTagSummary[]>([])
  const [isLoadingTags, setIsLoadingTags] = React.useState(true)

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
        title: "Main",
        items: [
          {
            title: "All Bookmarks",
            url: "/",
            icon: <BookmarkIcon className="size-4" weight="fill" />,
          },
          {
            title: "Favorites",
            url: "/favorites",
            icon: <HeartStraightIcon className="size-4" weight="fill" />,
          },
          {
            title: "Trash",
            url: "/trash",
            icon: <TrashIcon className="size-4" weight="fill" />,
          },
        ],
      },
    ]
  }, [])

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="flex h-12 w-full items-center justify-start">
          <img src={Logo.src} alt="HarborMarks logo" className="mr-2 h-6 w-6" />
          <h1 className="text-2xl font-bold">
            Harbor<span className="text-primary">Marks</span>
          </h1>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {/* We create a SidebarGroup for each parent. */}
        {navigationGroups.map((item) => (
          <SidebarGroup key={item.title}>
            <SidebarGroupLabel className="text-md">
              {item.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {item.items.map((item) => (
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
                          {item?.icon} {item.title}
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
          <SidebarGroupLabel className="text-md">Tags</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
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
                        <div className="flex items-center gap-2">
                          <HashIcon
                            size={16}
                            weight="thin"
                            className="text-primary"
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
          <LatestChangesDialog />
          <NavUser user={currentUser} />
        </SidebarFooter>
      ) : null}
      <SidebarRail />
    </Sidebar>
  )
}
