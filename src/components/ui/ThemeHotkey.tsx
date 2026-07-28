import { useTheme } from "next-themes"
import { useEffect } from "react"

const isEditableTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null
  if (!element) {
    return false
  }

  return Boolean(
    element.closest("input, textarea, select, [contenteditable='true']") ||
    element.isContentEditable
  )
}

export function ThemeHotkey() {
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) {
        return
      }

      const key = event.key.toLowerCase()
      const usesPlainD =
        key === "d" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey
      const usesCommandD =
        key === "d" && (event.metaKey || event.ctrlKey) && event.shiftKey

      if (!usesPlainD && !usesCommandD) {
        return
      }

      event.preventDefault()
      const nextTheme = resolvedTheme === "dark" ? "light" : "dark"
      setTheme(nextTheme)
    }

    window.addEventListener("keydown", handleKeydown)
    return () => {
      window.removeEventListener("keydown", handleKeydown)
    }
  }, [resolvedTheme, setTheme])

  return null
}
