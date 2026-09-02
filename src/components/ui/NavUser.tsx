import { ExportBookmarksDialog } from "@/components/dialog/ExportBookmarksDialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useSidebar } from "@/components/ui/sidebar-context"
import {
  CaretUpDownIcon,
  DownloadSimpleIcon,
  SealCheckIcon,
  SignOutIcon,
  SpinnerIcon,
  UsersIcon,
} from "@phosphor-icons/react"
import { useState } from "react"

export type SidebarUser = {
  id: number
  email: string
  displayName: string | null
  avatarUrl: string
  role: "admin" | "user"
}

export const NavUser = ({ user }: { user: SidebarUser }) => {
  const { isMobile } = useSidebar()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    if (isSigningOut) {
      return
    }

    setIsSigningOut(true)

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      })

      if (!response.ok) {
        throw new Error("Logout failed")
      }

      window.location.assign(response.redirected ? response.url : "/login")
    } catch {
      setIsSigningOut(false)
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage
                  src={user.avatarUrl}
                  alt={user.displayName ?? user.email}
                />
                <AvatarFallback className="rounded-lg">
                  {user.displayName?.[0] ?? user.email[0]}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {user.displayName ?? user.email}
                </span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <CaretUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage
                    src={user.avatarUrl}
                    alt={user.displayName ?? user.email}
                  />
                  <AvatarFallback className="rounded-lg">
                    {user.displayName?.[0] ?? user.email[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {user.displayName ?? user.email}
                  </span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem>
                <a
                  href={"/profile"}
                  className="flex w-full items-center gap-2 px-2 py-1.5"
                >
                  <SealCheckIcon />
                  Account
                </a>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            {user.role === "admin" && (
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <a
                    href={"/admin/users"}
                    className="flex w-full items-center gap-2 px-2 py-1.5"
                  >
                    <UsersIcon />
                    Users
                  </a>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <ExportBookmarksDialog
                  trigger={
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                    >
                      <DownloadSimpleIcon className="size-4" />
                      Export bookmarks
                    </button>
                  }
                />
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={isSigningOut}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
                onClick={() => {
                  void handleSignOut()
                }}
                disabled={isSigningOut}
                aria-busy={isSigningOut}
              >
                {isSigningOut ? (
                  <>
                    <SpinnerIcon className="size-4 animate-spin" />
                    Signing out...
                  </>
                ) : (
                  <>
                    <SignOutIcon className="size-4" />
                    Logout
                  </>
                )}
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
