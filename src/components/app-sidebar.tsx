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
import { NavUser, type SidebarUser } from "@/components/ui/NavUser"
import {
  BookmarkIcon,
  HashIcon,
  HeartStraightIcon,
} from "@phosphor-icons/react"

type SidebarTagSummary = {
  tag: string
  count: number
}

export function AppSidebar({
  currentUser,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  currentUser?: SidebarUser | null
}) {
  const [tags, setTags] = React.useState<SidebarTagSummary[]>([])
  const [isLoadingTags, setIsLoadingTags] = React.useState(true)
  const [activeTag, setActiveTag] = React.useState<string | null>(null)
  const [pathname, setPathname] = React.useState("")

  const syncRouteState = React.useCallback(() => {
    const { pathname: currentPathname, search } = window.location
    setPathname(currentPathname)

    if (currentPathname !== "/tag") {
      setActiveTag(null)
      return
    }

    const nextTag = new URLSearchParams(search).get("tag")?.trim() ?? ""
    setActiveTag(nextTag || null)
  }, [])

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

    return () => {
      abortController.abort()
    }
  }, [])

  React.useEffect(() => {
    syncRouteState()

    window.addEventListener("astro:page-load", syncRouteState)
    window.addEventListener("popstate", syncRouteState)

    return () => {
      window.removeEventListener("astro:page-load", syncRouteState)
      window.removeEventListener("popstate", syncRouteState)
    }
  }, [syncRouteState])

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
        ],
      },
    ]
  }, [])

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="flex h-12 w-full items-center justify-start">
          <img src={Logo.src} className="mr-2 h-6 w-6" />
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
                      <a href={item.url}>
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
                    <a href={`/tag?tag=${encodeURIComponent(tag.tag)}`}>
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
          <NavUser user={currentUser} />
        </SidebarFooter>
      ) : null}
      <SidebarRail />
    </Sidebar>
  )
}
