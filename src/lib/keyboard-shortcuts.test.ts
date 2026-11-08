import { describe, expect, it } from "vitest"

import {
  isAllowedWhileTyping,
  isTypingTarget,
  resolveShortcut,
  SHORTCUT_GROUPS,
  type KeyInput,
} from "./keyboard-shortcuts"

const press = (key: string, mods: Partial<KeyInput> = {}): KeyInput => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
})

describe("resolveShortcut", () => {
  it("maps bare keys to actions", () => {
    expect(resolveShortcut(press("/"), false).action).toEqual({
      type: "focus-search",
    })
    expect(resolveShortcut(press("j"), false).action).toEqual({
      type: "move",
      delta: 1,
    })
    expect(resolveShortcut(press("k"), false).action).toEqual({
      type: "move",
      delta: -1,
    })
    expect(resolveShortcut(press("?", { shiftKey: true }), false).action).toEqual(
      { type: "show-help" }
    )
    expect(resolveShortcut(press("#", { shiftKey: true }), false).action).toEqual(
      { type: "trash" }
    )
  })

  it("opens the palette with Ctrl or Cmd plus K only", () => {
    expect(resolveShortcut(press("k", { ctrlKey: true }), false).action).toEqual(
      { type: "show-palette" }
    )
    expect(resolveShortcut(press("k", { metaKey: true }), false).action).toEqual(
      { type: "show-palette" }
    )
    expect(
      resolveShortcut(press("k", { ctrlKey: true, shiftKey: true }), false)
        .action
    ).toBeNull()
  })

  it("never steals browser combos", () => {
    for (const key of ["f", "c", "a", "j", "e", "x"]) {
      expect(resolveShortcut(press(key, { ctrlKey: true }), false).action).toBeNull()
      expect(resolveShortcut(press(key, { metaKey: true }), false).action).toBeNull()
      expect(resolveShortcut(press(key, { altKey: true }), false).action).toBeNull()
    }
  })

  it("distinguishes x from Shift+X", () => {
    expect(resolveShortcut(press("x"), false).action).toEqual({
      type: "select",
      range: false,
    })
    expect(resolveShortcut(press("X", { shiftKey: true }), false).action).toEqual(
      { type: "select", range: true }
    )
  })

  it("ignores shifted letters that have no shortcut", () => {
    expect(resolveShortcut(press("J", { shiftKey: true }), false).action).toBeNull()
    expect(resolveShortcut(press("F", { shiftKey: true }), false).action).toBeNull()
  })

  it("supports g chords", () => {
    const armed = resolveShortcut(press("g"), false)
    expect(armed).toEqual({ action: null, chordPending: true })

    expect(resolveShortcut(press("t"), true)).toEqual({
      action: { type: "go", path: "/tags" },
      chordPending: false,
    })
    expect(resolveShortcut(press("r"), true).action).toEqual({
      type: "go",
      path: "/trash",
    })
  })

  it("drops the chord on an unknown second key and does not fall through", () => {
    // `g` then `j` must not also move the focus.
    expect(resolveShortcut(press("j"), true)).toEqual({
      action: null,
      chordPending: false,
    })
  })

  it("returns nothing for unrelated keys", () => {
    expect(resolveShortcut(press("q"), false)).toEqual({
      action: null,
      chordPending: false,
    })
  })
})

describe("isAllowedWhileTyping", () => {
  it("only allows escape and the palette", () => {
    expect(isAllowedWhileTyping({ type: "escape" })).toBe(true)
    expect(isAllowedWhileTyping({ type: "show-palette" })).toBe(true)
    expect(isAllowedWhileTyping({ type: "focus-search" })).toBe(false)
    expect(isAllowedWhileTyping({ type: "move", delta: 1 })).toBe(false)
  })
})

describe("isTypingTarget", () => {
  it("detects editable elements through closest()", () => {
    const editable = { closest: () => ({}), isContentEditable: false }
    const plain = { closest: () => null, isContentEditable: false }
    const rich = { closest: () => null, isContentEditable: true }

    expect(isTypingTarget(editable)).toBe(true)
    expect(isTypingTarget(plain)).toBe(false)
    expect(isTypingTarget(rich)).toBe(true)
    expect(isTypingTarget(null)).toBe(false)
    expect(isTypingTarget({})).toBe(false)
  })
})

describe("SHORTCUT_GROUPS", () => {
  it("has no duplicate single-key bindings across groups", () => {
    const seen = new Set<string>()
    for (const group of SHORTCUT_GROUPS) {
      for (const item of group.items) {
        for (const combo of item.keys) {
          const id = combo.join("+")
          expect(seen.has(id), `duplicate binding ${id}`).toBe(false)
          seen.add(id)
        }
      }
    }
  })
})
