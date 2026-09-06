export type CardViewMode = "grid" | "list" | "compact"

export const CARD_VIEW_STORAGE_KEY = "harbormarks:card-view"

export const DEFAULT_CARD_VIEW: CardViewMode = "grid"

const VALID_MODES: readonly CardViewMode[] = ["grid", "list", "compact"]

export function isCardViewMode(value: unknown): value is CardViewMode {
  return (
    typeof value === "string" &&
    (VALID_MODES as readonly string[]).includes(value)
  )
}

export function getStoredCardView(): CardViewMode {
  if (typeof window === "undefined") {
    return DEFAULT_CARD_VIEW
  }

  try {
    const stored = window.localStorage.getItem(CARD_VIEW_STORAGE_KEY)
    if (isCardViewMode(stored)) {
      return stored
    }
  } catch {
    // Private mode / blocked storage: fall through to the default.
  }

  return DEFAULT_CARD_VIEW
}

export function setStoredCardView(mode: CardViewMode): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(CARD_VIEW_STORAGE_KEY, mode)
  } catch {
    // Storage unavailable — the in-memory state still applies for the session.
  }
}
