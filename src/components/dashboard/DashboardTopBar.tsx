import {
  SidebarInput,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { ModeToggle } from "@/components/ui/ModeToggle"

// The dashboard top bar: a sidebar trigger, a prominent search field, and the
// theme toggle. It sticks to the top of the viewport with a translucent,
// blurred background so the cards scroll behind it (matching the proto).
// The "save a link" action and the wordmark live in the sidebar, not here.
export const DashboardTopBar = ({
  searchInput,
  onSearchChange,
  onSearchClear,
  isRefreshing,
  hasActiveSearch,
}: {
  searchInput: string
  onSearchChange: (value: string) => void
  onSearchClear: () => void
  isRefreshing: boolean
  hasActiveSearch: boolean
}) => {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-md">
      <SidebarTrigger className="-ml-1 shrink-0" />
      <div className="flex-1 max-w-[560px]">
        <SidebarInput
          id="search"
          placeholder="Search your harbor..."
          value={searchInput}
          onChange={(event) => onSearchChange(event.target.value)}
          onClear={onSearchClear}
          hint="tag: site: is:favorite"
        />
      </div>
      {isRefreshing ? (
        <span
          className="shrink-0 text-xs text-muted-foreground"
          aria-live="polite"
          role="status"
        >
          {hasActiveSearch ? "Searching…" : "Refreshing…"}
        </span>
      ) : null}
      <div className="flex-1" />
      <ModeToggle />
    </header>
  )
}
