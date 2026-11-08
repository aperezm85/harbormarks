import { useEffect, useMemo, useRef, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  CHORD_TIMEOUT_MS,
  GO_TO_TARGETS,
  isAllowedWhileTyping,
  isTypingTarget,
  OPEN_OVERLAY_SELECTOR,
  resolveShortcut,
  SHORTCUT_GROUPS,
  type ShortcutAction,
} from "@/lib/keyboard-shortcuts"
import type { BulkBookmarksAction } from "@/lib/bookmarks"
import type { BookmarkStatus, BookmarkTagSummary } from "@/lib/bookmark-types"

type KeyboardBookmark = {
  id: string
  isFavorite: boolean
  status: BookmarkStatus
}

type DashboardKeyboardProps = {
  bookmarks: KeyboardBookmark[]
  focusedId: string | null
  onFocusChange: (id: string | null) => void
  selectedIds: Set<string>
  onToggleSelect: (id: string, index: number, shiftKey: boolean) => void
  onClearSelection: () => void
  onBulk: (ids: string[], action: BulkBookmarksAction) => void
  onNavigate: (path: string) => void
  onApplyQuery: (query: string) => void
  enabled: boolean
}

function cardElement(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-bookmark-id="${CSS.escape(id)}"]`
  )
}

// Click a control inside the focused card, reusing the card's own handler
// (optimistic update, rollback, confirm dialog). Skips hidden/disabled controls
// such as the favorite button in Trash.
function clickInCard(id: string, selector: string): boolean {
  const control = cardElement(id)?.querySelector<HTMLButtonElement | HTMLAnchorElement>(
    selector
  )

  if (
    !control ||
    control.hidden ||
    (control instanceof HTMLButtonElement && control.disabled)
  ) {
    return false
  }

  control.click()
  return true
}

const FILTER_QUERIES = [
  { label: "Unread", query: "is:unread" },
  { label: "Reading", query: "is:reading" },
  { label: "Archived", query: "is:archived" },
  { label: "Favorites", query: "is:favorite" },
  { label: "Broken links", query: "is:broken" },
  { label: "With image", query: "has:image" },
]

type PaletteItem = {
  id: string
  group: "Filters" | "Tags" | "Go to" | "Actions"
  label: string
  hint?: string
  run: () => void
}

export function DashboardKeyboard({
  bookmarks,
  focusedId,
  onFocusChange,
  selectedIds,
  onToggleSelect,
  onClearSelection,
  onBulk,
  onNavigate,
  onApplyQuery,
  enabled,
}: DashboardKeyboardProps) {
  const [helpOpen, setHelpOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const chordRef = useRef(false)
  const chordTimerRef = useRef<number | null>(null)

  // The key handler is attached once; it reads the latest props through a ref
  // that is refreshed after every render.
  const latest = useRef({
    bookmarks,
    focusedId,
    onFocusChange,
    selectedIds,
    onToggleSelect,
    onClearSelection,
    onBulk,
    onNavigate,
    enabled,
  })
  useEffect(() => {
    latest.current = {
      bookmarks,
      focusedId,
      onFocusChange,
      selectedIds,
      onToggleSelect,
      onClearSelection,
      onBulk,
      onNavigate,
      enabled,
    }
  })

  useEffect(() => {
    function clearChord() {
      chordRef.current = false
      if (chordTimerRef.current !== null) {
        window.clearTimeout(chordTimerRef.current)
        chordTimerRef.current = null
      }
    }

    function perform(action: ShortcutAction, event: KeyboardEvent) {
      const state = latest.current
      const { bookmarks: list, focusedId: focused, selectedIds: selected } = state
      const selectionActive = selected.size > 0
      const focusedIndex = focused
        ? list.findIndex((bookmark) => bookmark.id === focused)
        : -1

      switch (action.type) {
        case "focus-search": {
          const input = document.getElementById("search") as HTMLInputElement | null
          if (input) {
            event.preventDefault()
            input.focus()
            input.select()
          }
          return
        }
        case "show-help":
          event.preventDefault()
          setHelpOpen(true)
          return
        case "show-palette":
          event.preventDefault()
          setPaletteOpen(true)
          return
        case "move": {
          if (list.length === 0) return
          event.preventDefault()
          const nextIndex =
            focusedIndex === -1
              ? 0
              : Math.min(list.length - 1, Math.max(0, focusedIndex + action.delta))
          state.onFocusChange(list[nextIndex].id)
          return
        }
        case "escape": {
          const target = event.target as HTMLElement | null
          if (isTypingTarget(target)) {
            target?.blur()
            return
          }
          if (selectionActive) {
            state.onClearSelection()
          } else if (focused) {
            state.onFocusChange(null)
          }
          return
        }
        case "go":
          event.preventDefault()
          state.onNavigate(action.path)
          return
        case "select": {
          if (focusedIndex === -1) return
          event.preventDefault()
          state.onToggleSelect(list[focusedIndex].id, focusedIndex, action.range)
          return
        }
        case "favorite": {
          if (selectionActive) {
            event.preventDefault()
            const chosen = list.filter((bookmark) => selected.has(bookmark.id))
            const allFavorite = chosen.every((bookmark) => bookmark.isFavorite)
            state.onBulk([...selected], allFavorite ? "unfavorite" : "favorite")
            return
          }
          if (focused) {
            event.preventDefault()
            clickInCard(
              focused,
              "button[aria-label='Add favorite'], button[aria-label='Remove favorite']"
            )
          }
          return
        }
        case "archive": {
          if (selectionActive) {
            event.preventDefault()
            const chosen = list.filter((bookmark) => selected.has(bookmark.id))
            const allArchived = chosen.every(
              (bookmark) => bookmark.status === "archived"
            )
            state.onBulk([...selected], allArchived ? "unarchive" : "archive")
            return
          }
          if (focusedIndex !== -1) {
            event.preventDefault()
            const bookmark = list[focusedIndex]
            state.onBulk(
              [bookmark.id],
              bookmark.status === "archived" ? "unarchive" : "archive"
            )
          }
          return
        }
        case "trash": {
          if (selectionActive) {
            event.preventDefault()
            state.onBulk([...selected], "delete")
            return
          }
          if (focused) {
            event.preventDefault()
            clickInCard(focused, "button[aria-label='Delete bookmark']")
          }
          return
        }
        case "edit":
        case "copy-link":
        case "open": {
          if (!focused) return
          // Enter must keep its native meaning on a focused button or link.
          if (
            action.type === "open" &&
            event.key === "Enter" &&
            event.target !== document.body
          ) {
            return
          }
          event.preventDefault()
          clickInCard(
            focused,
            action.type === "edit"
              ? "button[aria-label='Edit bookmark']"
              : action.type === "copy-link"
                ? "button[aria-label='Copy link']"
                : "a[aria-label^='Open bookmark']"
          )
          return
        }
      }
    }

    function handleKeydown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || !latest.current.enabled) {
        return
      }

      const { action, chordPending } = resolveShortcut(
        event,
        chordRef.current
      )

      clearChord()

      // Another dialog, menu, or listbox is open (including our own).
      if (document.querySelector(OPEN_OVERLAY_SELECTOR)) {
        return
      }

      if (chordPending) {
        if (isTypingTarget(event.target)) return
        chordRef.current = true
        chordTimerRef.current = window.setTimeout(clearChord, CHORD_TIMEOUT_MS)
        return
      }

      if (!action) {
        return
      }

      if (isTypingTarget(event.target) && !isAllowedWhileTyping(action)) {
        return
      }

      perform(action, event)
    }

    window.addEventListener("keydown", handleKeydown)
    return () => {
      window.removeEventListener("keydown", handleKeydown)
      clearChord()
    }
  }, [])

  return (
    <>
      <ShortcutHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onNavigate={onNavigate}
        onApplyQuery={onApplyQuery}
        onShowHelp={() => setHelpOpen(true)}
      />
    </>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-block min-w-5 rounded border border-b-2 bg-muted px-1.5 py-0.5 text-center font-mono text-[11px] leading-none text-muted-foreground">
      {children}
    </kbd>
  )
}

function ShortcutHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts are off while you type in a field or have a dialog open.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-3">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} aria-label={group.title}>
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                {group.title}
              </h3>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between gap-3"
                  >
                    <span>{item.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map((combo, comboIndex) => (
                        <span
                          key={combo.join("+")}
                          className="flex items-center gap-1"
                        >
                          {comboIndex > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              or
                            </span>
                          ) : null}
                          {combo.map((key, keyIndex) => (
                            <span key={key} className="flex items-center gap-1">
                              {keyIndex > 0 && combo[0] === "g" ? (
                                <span className="text-xs text-muted-foreground">
                                  then
                                </span>
                              ) : null}
                              <Kbd>{key}</Kbd>
                            </span>
                          ))}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
  onApplyQuery,
  onShowHelp,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (path: string) => void
  onApplyQuery: (query: string) => void
  onShowHelp: () => void
}) {
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [tags, setTags] = useState<BookmarkTagSummary[]>([])

  // Fresh tag list each time the palette opens (tags change as users save).
  useEffect(() => {
    if (!open) {
      return
    }

    const controller = new AbortController()

    fetch("/api/bookmarks/tags", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: BookmarkTagSummary[] } | null) => {
        setTags(payload?.data ?? [])
      })
      .catch(() => {
        // The palette still works without tag jumps.
      })

    return () => controller.abort()
  }, [open])

  const items = useMemo<PaletteItem[]>(() => {
    const close = () => onOpenChange(false)

    return [
      ...FILTER_QUERIES.map((filter) => ({
        id: `filter:${filter.query}`,
        group: "Filters" as const,
        label: filter.label,
        hint: filter.query,
        run: () => {
          close()
          onApplyQuery(filter.query)
        },
      })),
      ...tags.map((entry) => ({
        id: `tag:${entry.tag}`,
        group: "Tags" as const,
        label: `#${entry.tag}`,
        hint: String(entry.count),
        run: () => {
          close()
          onNavigate(`/tag?tag=${encodeURIComponent(entry.tag)}`)
        },
      })),
      ...Object.entries(GO_TO_TARGETS).map(([key, target]) => ({
        id: `go:${target.path}`,
        group: "Go to" as const,
        label: target.label,
        hint: `g ${key}`,
        run: () => {
          close()
          onNavigate(target.path)
        },
      })),
      {
        id: "action:save",
        group: "Actions" as const,
        label: "Save a bookmark",
        hint: "n",
        run: () => {
          close()
          window.dispatchEvent(new CustomEvent("harbormarks:open-save"))
        },
      },
      {
        id: "action:help",
        group: "Actions" as const,
        label: "Show keyboard shortcuts",
        hint: "?",
        run: () => {
          close()
          onShowHelp()
        },
      },
    ]
  }, [tags, onApplyQuery, onNavigate, onOpenChange, onShowHelp])

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? items.filter((item) =>
        `${item.label} ${item.hint ?? ""}`.toLowerCase().includes(needle)
      )
    : items
  const safeIndex = Math.min(activeIndex, Math.max(visible.length - 1, 0))

  // Keep the highlighted row in view while arrowing through a long tag list.
  useEffect(() => {
    document
      .querySelector("[data-palette-active='true']")
      ?.scrollIntoView({ block: "nearest" })
  }, [safeIndex, open])

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setQuery("")
      setActiveIndex(0)
    }
    onOpenChange(next)
  }

  let lastGroup = ""

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[20%] translate-y-0 gap-0 p-0 sm:max-w-lg"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Command palette</DialogTitle>
          <DialogDescription>
            Jump to a filter, tag, or page.
          </DialogDescription>
        </DialogHeader>
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault()
              setActiveIndex(Math.min(safeIndex + 1, visible.length - 1))
            } else if (event.key === "ArrowUp") {
              event.preventDefault()
              setActiveIndex(Math.max(safeIndex - 1, 0))
            } else if (event.key === "Enter") {
              event.preventDefault()
              visible[safeIndex]?.run()
            }
          }}
          placeholder="Type a filter, tag, or page..."
          aria-label="Command palette search"
          className="w-full border-b bg-transparent px-4 py-3 text-sm outline-none"
        />
        <div className="max-h-72 overflow-y-auto py-1" role="listbox">
          {visible.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nothing matches "{query.trim()}".
            </p>
          ) : (
            visible.map((item, index) => {
              const showGroup = item.group !== lastGroup
              lastGroup = item.group
              return (
                <div key={item.id}>
                  {showGroup ? (
                    <p className="px-4 pt-2 pb-1 text-[11px] text-muted-foreground">
                      {item.group}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === safeIndex}
                    data-palette-active={index === safeIndex}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => item.run()}
                    className={`flex w-full items-center justify-between px-4 py-1.5 text-left text-sm ${
                      index === safeIndex ? "bg-accent text-accent-foreground" : ""
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    {item.hint ? (
                      <span className="ml-3 shrink-0 font-mono text-xs text-muted-foreground">
                        {item.hint}
                      </span>
                    ) : null}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
