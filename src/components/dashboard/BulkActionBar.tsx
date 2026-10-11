import { useState } from "react"

import type { BulkBookmarksAction } from "@/lib/bookmarks"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { SelectCheckbox } from "@/components/ui/select-checkbox"
import {
  ArchiveIcon,
  DotsThreeIcon,
  HeartStraightIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react"

// Gmail-style selection strip: a single compact pill that appears only while
// something is selected. Header checkbox tri-states across the loaded page;
// primary icon actions stay visible, the rest live in the overflow menu, and
// tag add/remove opens a small dialog instead of a permanently visible input.
export const BulkActionBar = ({
  selectedCount,
  totalLoaded,
  isWorking,
  onToggleSelectAll,
  onClear,
  onAction,
}: {
  selectedCount: number
  totalLoaded: number
  isWorking: boolean
  onToggleSelectAll: () => void
  onClear: () => void
  onAction: (action: BulkBookmarksAction, tags?: string[]) => void
}) => {
  const [tagMode, setTagMode] = useState<"add-tags" | "remove-tags" | null>(
    null
  )
  const [tagInput, setTagInput] = useState("")

  const allLoadedSelected =
    totalLoaded > 0 && selectedCount >= totalLoaded
  const partiallySelected =
    selectedCount > 0 && selectedCount < totalLoaded

  if (selectedCount === 0) {
    return null
  }

  const pendingTags = tagInput
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)

  const closeTagDialog = () => {
    setTagMode(null)
    setTagInput("")
  }

  const applyTagDialog = () => {
    if (!tagMode || pendingTags.length === 0) {
      return
    }

    onAction(tagMode, pendingTags)
    closeTagDialog()
  }

  const iconButtonClassName =
    "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"

  return (
    <>
      <div
        aria-live="polite"
        className="sticky top-32 z-30 mt-0 mb-3 flex items-center gap-1 rounded-full border bg-background/95 py-1.5 pr-1.5 pl-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80"
      >
        <SelectCheckbox
          checked={allLoadedSelected}
          indeterminate={partiallySelected}
          disabled={isWorking}
          label={
            allLoadedSelected ? "Deselect loaded bookmarks" : "Select loaded bookmarks"
          }
          onToggle={() => onToggleSelectAll()}
        />
        <span className="pl-1 text-sm font-medium whitespace-nowrap">
          {selectedCount} selected
        </span>
        <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />

        <button
          type="button"
          disabled={isWorking}
          aria-label="Favorite selected"
          title="Favorite"
          onClick={() => onAction("favorite")}
          className={iconButtonClassName}
        >
          <HeartStraightIcon className="size-4" />
        </button>
        <button
          type="button"
          disabled={isWorking}
          aria-label="Archive selected"
          title="Archive"
          onClick={() => onAction("archive")}
          className={iconButtonClassName}
        >
          <ArchiveIcon className="size-4" />
        </button>
        <button
          type="button"
          disabled={isWorking}
          aria-label="Delete selected"
          title="Move to Trash"
          onClick={() => onAction("delete")}
          className={`${iconButtonClassName} hover:text-destructive`}
        >
          <TrashIcon className="size-4" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={isWorking}
              aria-label="More bulk actions"
              title="More actions"
              className={iconButtonClassName}
            >
              <DotsThreeIcon className="size-4" weight="bold" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => onAction("unfavorite")}>
              Unfavorite
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAction("unarchive")}>
              Move back to reading
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setTagInput("")
                setTagMode("add-tags")
              }}
            >
              Add tags…
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setTagInput("")
                setTagMode("remove-tags")
              }}
            >
              Remove tags…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={isWorking}
          aria-label="Clear selection"
          title="Clear selection"
          onClick={onClear}
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      <Dialog
        open={tagMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeTagDialog()
          }
        }}
      >
        <DialogContent
          className="sm:max-w-sm"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>
              {tagMode === "add-tags" ? "Add tags" : "Remove tags"}
            </DialogTitle>
            <DialogDescription>
              {tagMode === "add-tags"
                ? `Add tags to ${selectedCount} selected bookmark${selectedCount === 1 ? "" : "s"}. Comma separated.`
                : `Remove tags from ${selectedCount} selected bookmark${selectedCount === 1 ? "" : "s"}. Comma separated.`}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={tagInput}
            autoFocus
            placeholder="reading, rust"
            aria-label="Tags, comma separated"
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && pendingTags.length > 0) {
                event.preventDefault()
                applyTagDialog()
              }
            }}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={closeTagDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pendingTags.length === 0}
              onClick={applyTagDialog}
            >
              {tagMode === "add-tags" ? "Add" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
