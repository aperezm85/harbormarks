import { describe, expect, it } from "vitest"

import {
  TAG_DOT_DARK,
  TAG_DOT_LIGHT,
  TAG_HUES,
  SIDEBAR_DARK,
  SIDEBAR_LIGHT,
  tagColor,
  tagHue,
} from "./tag-color"

type Oklch = { l: number; c: number; h: number }

// OKLCH -> sRGB -> relative luminance, per the OKLab specification. Used only to
// prove the contrast guarantee; the production path renders the hue via CSS.
function oklchToSrgb({ l, c, h }: Oklch): { r: number; g: number; b: number } {
  const rad = (h * Math.PI) / 180
  const a = c * Math.cos(rad)
  const b = c * Math.sin(rad)

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b

  const lC = l_ ** 3
  const mC = m_ ** 3
  const sC = s_ ** 3

  const r = 4.0767416621 * lC - 3.3077115913 * mC + 0.2309699292 * sC
  const g = -1.2684380046 * lC + 2.6097574011 * mC - 0.3413193965 * sC
  const b2 = -0.0041960863 * lC - 0.0033880933 * mC + 1.0139891155 * sC

  const gamma = (x: number) => {
    const clamped = Math.min(1, Math.max(0, x))
    return clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * clamped ** (1 / 2.4) - 0.055
  }

  return { r: gamma(r), g: gamma(g), b: gamma(b2) }
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: number, b: number) {
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

function dotLuminance(theme: "light" | "dark", hue: number) {
  const { l, c } = theme === "dark" ? TAG_DOT_DARK : TAG_DOT_LIGHT
  return relativeLuminance(oklchToSrgb({ l, c, h: hue }))
}

describe("tag-color", () => {
  it("assigns a stable hue to a tag (case- and whitespace-insensitive)", () => {
    expect(tagHue("postgres")).toBe(tagHue("postgres"))
    expect(tagHue("Postgres")).toBe(tagHue("postgres"))
    expect(tagHue("  postgres  ")).toBe(tagHue("postgres"))
  })

  it("spreads distinct tags across the palette (no single slot dominates)", () => {
    const tags = Array.from({ length: 80 }, (_, i) => `tag-${i}`)
    const used = new Set(tags.map(tagHue))
    expect(used.size).toBeGreaterThan(TAG_HUES.length / 2)
  })

  it("keeps every palette hue within [0, 360)", () => {
    for (const hue of TAG_HUES) {
      expect(hue).toBeGreaterThanOrEqual(0)
      expect(hue).toBeLessThan(360)
    }
  })

  it("is accessible (>= 3:1) against the sidebar in BOTH themes", () => {
    const lightSidebarY = relativeLuminance(oklchToSrgb(SIDEBAR_LIGHT))
    const darkSidebarY = relativeLuminance(oklchToSrgb(SIDEBAR_DARK))

    for (const hue of TAG_HUES) {
      const lightContrast = contrast(dotLuminance("light", hue), lightSidebarY)
      const darkContrast = contrast(dotLuminance("dark", hue), darkSidebarY)
      expect(lightContrast, `light theme, hue ${hue}`).toBeGreaterThanOrEqual(3)
      expect(darkContrast, `dark theme, hue ${hue}`).toBeGreaterThanOrEqual(3)
    }
  })

  it("renders a lighter dot in dark mode than in light mode", () => {
    for (const hue of TAG_HUES) {
      expect(dotLuminance("dark", hue)).toBeGreaterThan(
        dotLuminance("light", hue)
      )
    }
  })

  it("produces a valid oklch() string", () => {
    expect(tagColor("postgres", "light")).toMatch(/^oklch\(/)
    expect(tagColor("postgres", "dark")).toMatch(/^oklch\(/)
  })
})
