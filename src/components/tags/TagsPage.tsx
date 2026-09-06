import { AppSidebar } from "@/components/app-sidebar"
import { TagManager } from "@/components/tags/TagManager"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import type { SidebarUser } from "@/components/ui/NavUser"

export function TagsPage({ currentUser }: { currentUser?: SidebarUser | null }) {
  return (
    <SidebarProvider>
      <AppSidebar currentUser={currentUser} />
      <SidebarInset>
        <TagManager />
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  )
}
