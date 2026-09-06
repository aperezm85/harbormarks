import {
  ListBulletsIcon,
  RowsIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react"

import type { CardViewMode } from "@/lib/card-view"
import { cn } from "@/lib/utils"

const OPTIONS: {
  value: CardViewMode
  label: string
  title: string
  Icon: typeof SquaresFourIcon
}[] = [
  {
    value: "grid",
    label: "Card view",
    title: "Card view",
    Icon: SquaresFourIcon,
  },
  {
    value: "list",
    label: "Card list view",
    title: "Card list view",
    Icon: RowsIcon,
  },
  {
    value: "compact",
    label: "Compact view",
    title: "Compact view",
    Icon: ListBulletsIcon,
  },
]

// Segmented card-view switch. Mirrors the proto's `.seg` control (grid / list /
// compact) and sits in the top bar just before the theme toggle. Controlled:
// the parent owns the state and persistence.
export function CardViewSelector({
  value,
  onChange,
}: {
  value: CardViewMode
  onChange: (next: CardViewMode) => void
}) {
  return (
    <div
      role="group"
      aria-label="Card view"
      className="flex shrink-0 items-center gap-0.5 rounded-md bg-muted p-0.5"
    >
      {OPTIONS.map(({ value: option, label, title, Icon }) => {
        const isActive = option === value
        return (
          <button
            key={option}
            type="button"
            aria-label={label}
            aria-pressed={isActive}
            title={title}
            onClick={() => {
              if (!isActive) {
                onChange(option)
              }
            }}
            className={cn(
              "flex size-7 items-center justify-center rounded-[calc(var(--radius-sm)-1px)] transition-colors",
              isActive
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}
