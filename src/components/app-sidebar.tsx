import * as React from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

import Logo from "@/assets/harborMark.svg"
import {
  BookmarkIcon,
  HeartStraightIcon,
  TagSimpleIcon,
} from "@phosphor-icons/react"

// This is sample data.
const data = {
  navMain: [
    {
      title: "Main",
      url: "#",
      items: [
        {
          title: "All Bookmarks",
          url: "#",
          icon: <BookmarkIcon className="size-4" weight="fill" />,
          isActive: true,
        },
        {
          title: "Tags",
          url: "#",
          icon: <TagSimpleIcon className="size-4" weight="fill" />,
        },
        {
          title: "Favorites",
          url: "#",
          icon: <HeartStraightIcon className="size-4" weight="fill" />,
        },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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
        {data.navMain.map((item) => (
          <SidebarGroup key={item.title}>
            <SidebarGroupLabel className="text-md">
              {item.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-2">
                {item.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={item.isActive}
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
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
