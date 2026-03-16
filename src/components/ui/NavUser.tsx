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
  useSidebar,
} from "@/components/ui/sidebar"
import {
  CaretUpDownIcon,
  SealCheckIcon,
  SignOutIcon,
  UsersIcon,
} from "@phosphor-icons/react"
import { Button } from "./button"

export type SidebarUser = {
  id: number
  email: string
  displayName: string | null
  avatarUrl: string
  role: "admin" | "user"
}

export const NavUser = ({ user }: { user: SidebarUser }) => {
  const { isMobile } = useSidebar()

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
                <a href={"/profile"} className="flex w-full items-center gap-2">
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
                    className="flex w-full items-center gap-2"
                  >
                    <UsersIcon />
                    Users
                  </a>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <form method="POST" action="/api/auth/logout">
                <Button
                  type="submit"
                  size="sm"
                  variant="ghost"
                  className="w-full"
                >
                  <SignOutIcon className="mr-2" />
                  Logout
                </Button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
