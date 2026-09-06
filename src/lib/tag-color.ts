// Deterministic, theme-adaptive tag colors for the sidebar.
//
// A tag's *hue* is a stable function of its name (FNV-1a hash -> palette slot),
// so the same tag always gets the same hue regardless of what other tags exist
// or how their counts change. The lightness/chroma, however, is theme-scoped:
// the dot renders darker in light mode and lighter in dark mode so it clears the
// WCAG non-text contrast floor (3:1) against the sidebar background in BOTH
// themes. A single fixed color cannot do that — it would have to be
// simultaneously dark enough for a near-white background and light enough for a
// dark one.
//
// TAG_DOT_LIGHT / TAG_DOT_DARK are the source of truth for the `.tag-dot` rule
// in src/styles/global.css (keep them in sync). tag-color.test.ts asserts the
// contrast guarantee.

export const TAG_HUES = [
  0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240,
  255, 270, 285, 300, 315, 330, 345,
] as const

// Theme-scoped lightness (L) and chroma (C) for the dot. See global.css `.tag-dot`.
// Light mode sits low (darker) so the lightest hues (greens/yellows) still clear
// 3:1 on the near-white sidebar; dark mode sits high (lighter) so the darkest
// hues (blues) clear 3:1 on the dark sidebar.
export const TAG_DOT_LIGHT = { l: 0.38, c: 0.13 }
export const TAG_DOT_DARK = { l: 0.68, c: 0.15 }

// Sidebar backgrounds, mirrored from src/styles/global.css (--sidebar in :root / .dark).
export const SIDEBAR_LIGHT = { l: 0.987, c: 0.002, h: 197.1 }
export const SIDEBAR_DARK = { l: 0.218, c: 0.008, h: 223.9 }

function fnv1a(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Stable hue (degrees) for a tag, derived from its name. */
export function tagHue(tag: string): number {
  const key = tag.trim().toLowerCase()
  return TAG_HUES[fnv1a(key) % TAG_HUES.length]
}

/** Full OKLCH color for a tag at a given theme (used by tests / JS consumers). */
export function tagColor(tag: string, theme: "light" | "dark"): string {
  const { l, c } = theme === "dark" ? TAG_DOT_DARK : TAG_DOT_LIGHT
  return `oklch(${l} ${c} ${tagHue(tag)})`
}
