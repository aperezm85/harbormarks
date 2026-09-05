const SYSTEM_MEDIA_QUERY = "(prefers-color-scheme: dark)"
const STORAGE_KEY = "theme"

export type ThemeMode = "light" | "dark" | "system"

export const getStoredThemeMode = (): ThemeMode | null => {
  if (typeof window === "undefined") {
    return null
  }

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored
  }

  return null
}

export const resolveThemeMode = (mode: ThemeMode | null): "light" | "dark" => {
  if (mode === "light" || mode === "dark") {
    return mode
  }

  if (typeof window === "undefined") {
    return "light"
  }

  return window.matchMedia(SYSTEM_MEDIA_QUERY).matches ? "dark" : "light"
}

export const applyThemePreference = (mode: ThemeMode | null) => {
  if (typeof document === "undefined") {
    return
  }

  const resolvedTheme = resolveThemeMode(mode)
  document.documentElement.classList.toggle("dark", resolvedTheme === "dark")
}

export const setThemeMode = (mode: ThemeMode) => {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, mode)
  applyThemePreference(mode)
}

export const toggleThemeMode = () => {
  if (typeof document === "undefined") {
    return
  }

  const nextMode = document.documentElement.classList.contains("dark")
    ? "light"
    : "dark"
  setThemeMode(nextMode)
}
