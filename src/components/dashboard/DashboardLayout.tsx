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
            className="pl-8"
          />
          <CreateBookmarkDialog />
          <Separator orientation="vertical" className="mr-2 h-full" />
          <ModeToggle />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="min-h-screen flex-1 rounded-xl bg-muted/50 md:min-h-min">
            <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
              {bookmarks.map((bookmark) => (
                <HarborCard key={bookmark.id} {...bookmark} />
              ))}
              {bookmarks.length === 0 && (
                <div className="col-span-full rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No bookmarks yet. Add your first bookmark to start building
                  your harbor.
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
