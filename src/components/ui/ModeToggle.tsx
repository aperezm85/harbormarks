import { MoonIcon, SunIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { toggleThemeMode } from "@/lib/theme-client"

// Two-state theme toggle: click flips light <-> dark and persists the choice to
// localStorage. There is no "system" option in the UI — the OS preference only
// applies until the user makes an explicit choice (see theme-client + the inline
// script in layouts/main.astro, which is the app's actual theme controller).
export function ModeToggle() {
  return (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleThemeMode}
          className="shrink-0"
          aria-label="Toggle theme"
          title="Toggle theme"
        >
      <SunIcon className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <MoonIcon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
