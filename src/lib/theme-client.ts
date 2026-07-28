export type ThemeMode = "light" | "dark" | "system"

export const isThemeMode = (value: string | null): value is ThemeMode => {
  return value === "light" || value === "dark" || value === "system"
}

export const getStoredThemeMode = (): ThemeMode | null => {
  if (typeof window === "undefined") {
    return null
  }

  const storedTheme = window.localStorage.getItem("theme")
  return isThemeMode(storedTheme) ? storedTheme : null
}

export const resolveThemeMode = (
  mode: ThemeMode | null = getStoredThemeMode()
) => {
  if (mode === "light" || mode === "dark") {
    return mode
  }

  if (typeof window === "undefined") {
    return "light"
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

export const applyThemePreference = (
  mode: ThemeMode | null = getStoredThemeMode()
) => {
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

  window.localStorage.setItem("theme", mode)
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
