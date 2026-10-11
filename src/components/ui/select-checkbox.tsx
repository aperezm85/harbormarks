import { CheckIcon, MinusIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

// Custom tri-state checkbox. Native inputs with `accent-*` render
// inconsistently across browsers and themes (black unchecked box in light
// mode, mismatched blues for checked vs indeterminate), so selection uses
// this button-based control everywhere: cards and the bulk header share it.
export const SelectCheckbox = ({
  checked,
  indeterminate = false,
  disabled = false,
  label,
  onToggle,
  className,
}: {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  label: string
  onToggle: (shiftKey: boolean) => void
  className?: string
}) => {
  const mixed = indeterminate && !checked

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={mixed ? "mixed" : checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation()
        onToggle(event.shiftKey)
      }}
      className={cn(
        "inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-[6px] border shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        checked || mixed
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-transparent hover:border-primary/60",
        className
      )}
    >
      {mixed ? (
        <MinusIcon className="size-3.5" weight="bold" />
      ) : (
        <CheckIcon
          className={cn("size-3.5", !checked && "opacity-0")}
          weight="bold"
        />
      )}
    </button>
  )
}
