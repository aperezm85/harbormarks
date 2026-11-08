// Keyboard shortcuts for the bookmark dashboard.
//
// This module is deliberately DOM-free (the typing/overlay guards take the
// minimum shape they need) so the keymap can be unit-tested in node and so the
// cheat sheet and the key handler read the same table.

export type ShortcutAction =
  | { type: "focus-search" }
  | { type: "show-help" }
  | { type: "show-palette" }
  | { type: "move"; delta: 1 | -1 }
  | { type: "open" }
  | { type: "edit" }
  | { type: "favorite" }
  | { type: "archive" }
  | { type: "copy-link" }
  | { type: "trash" }
  | { type: "select"; range: boolean }
  | { type: "escape" }
  | { type: "go"; path: string }

export type KeyInput = {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

export type ResolveResult = {
  action: ShortcutAction | null
  // Whether the `g` chord prefix is armed after this key.
  chordPending: boolean
}

// `g` + letter navigation targets.
export const GO_TO_TARGETS: Record<string, { path: string; label: string }> = {
  h: { path: "/", label: "Home" },
  f: { path: "/favorites", label: "Favorites" },
  t: { path: "/tags", label: "Tags" },
  d: { path: "/dashboard", label: "Dashboard" },
  r: { path: "/trash", label: "Trash" },
}

// How long (ms) the `g` prefix stays armed waiting for its second key.
export const CHORD_TIMEOUT_MS = 1200

const NONE: ResolveResult = { action: null, chordPending: false }

export function resolveShortcut(
  input: KeyInput,
  chordPending: boolean
): ResolveResult {
  const { key, ctrlKey, metaKey, altKey, shiftKey } = input

  // Command palette is the only shortcut that uses a modifier.
  if ((ctrlKey || metaKey) && !altKey && !shiftKey && key.toLowerCase() === "k") {
    return { action: { type: "show-palette" }, chordPending: false }
  }

  // Every other shortcut is a bare key (Shift is allowed because `?`, `#` and
  // `Shift+X` need it). Never steal browser/OS combos.
  if (ctrlKey || metaKey || altKey) {
    return NONE
  }

  if (chordPending) {
    const target = GO_TO_TARGETS[key.toLowerCase()]
    return target
      ? { action: { type: "go", path: target.path }, chordPending: false }
      : NONE
  }

  switch (key) {
    case "/":
      return { action: { type: "focus-search" }, chordPending: false }
    case "?":
      return { action: { type: "show-help" }, chordPending: false }
    case "Escape":
      return { action: { type: "escape" }, chordPending: false }
    case "Enter":
      return { action: { type: "open" }, chordPending: false }
    case "#":
      return { action: { type: "trash" }, chordPending: false }
    case "X":
      return {
        action: { type: "select", range: true },
        chordPending: false,
      }
  }

  if (shiftKey) {
    return NONE
  }

  switch (key) {
    case "g":
      return { action: null, chordPending: true }
    case "j":
      return { action: { type: "move", delta: 1 }, chordPending: false }
    case "k":
      return { action: { type: "move", delta: -1 }, chordPending: false }
    case "o":
      return { action: { type: "open" }, chordPending: false }
    case "e":
      return { action: { type: "edit" }, chordPending: false }
    case "f":
      return { action: { type: "favorite" }, chordPending: false }
    case "a":
      return { action: { type: "archive" }, chordPending: false }
    case "c":
      return { action: { type: "copy-link" }, chordPending: false }
    case "x":
      return {
        action: { type: "select", range: false },
        chordPending: false,
      }
  }

  return NONE
}

// Shortcuts that must keep working while the user is typing: only Escape (to
// leave the field) and the modifier-based palette.
export function isAllowedWhileTyping(action: ShortcutAction): boolean {
  return action.type === "escape" || action.type === "show-palette"
}

const TYPING_SELECTOR =
  "input, textarea, select, [contenteditable=''], [contenteditable='true']"

type ClosestCapable = {
  closest?: (selector: string) => unknown
  isContentEditable?: boolean
}

export function isTypingTarget(target: unknown): boolean {
  const element = target as ClosestCapable | null

  if (!element || typeof element.closest !== "function") {
    return false
  }

  return Boolean(element.closest(TYPING_SELECTOR)) || element.isContentEditable === true
}

// Selector for any open modal surface: single-key shortcuts must not fire
// underneath a dialog, menu, or listbox.
export const OPEN_OVERLAY_SELECTOR =
  "[role='dialog'][data-state='open'], [role='alertdialog'][data-state='open'], [role='menu'][data-state='open'], [role='listbox'][data-state='open']"

export type ShortcutGroup = {
  title: string
  items: { label: string; keys: string[][] }[]
}

// Single source of truth for the cheat sheet. Each `keys` entry is one
// alternative; the inner array is the sequence pressed in order.
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Navigate",
    items: [
      { label: "Focus search", keys: [["/"]] },
      { label: "Next card", keys: [["j"]] },
      { label: "Previous card", keys: [["k"]] },
      { label: "Command palette", keys: [["Ctrl", "K"]] },
      { label: "Go to Home", keys: [["g", "h"]] },
      { label: "Go to Favorites", keys: [["g", "f"]] },
      { label: "Go to Tags", keys: [["g", "t"]] },
      { label: "Go to Dashboard", keys: [["g", "d"]] },
      { label: "Go to Trash", keys: [["g", "r"]] },
    ],
  },
  {
    title: "Focused card",
    items: [
      { label: "Open link", keys: [["Enter"], ["o"]] },
      { label: "Edit", keys: [["e"]] },
      { label: "Favorite", keys: [["f"]] },
      { label: "Archive", keys: [["a"]] },
      { label: "Copy link", keys: [["c"]] },
      { label: "Move to Trash", keys: [["#"]] },
    ],
  },
  {
    title: "Selection and global",
    items: [
      { label: "Save a bookmark", keys: [["n"]] },
      { label: "Select card", keys: [["x"]] },
      { label: "Select range", keys: [["Shift", "X"]] },
      { label: "Clear selection", keys: [["Esc"]] },
      { label: "Show shortcuts", keys: [["?"]] },
    ],
  },
]
