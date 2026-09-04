import { XIcon } from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import type { BookmarkQueryOperator } from "@/lib/bookmark-query"

// Removable chips for the operators parsed out of the active search query.
// This file exports only the component so it satisfies
// `react-refresh/only-export-components`; the parsing lives in the pure
// `@/lib/bookmark-query` module.
export const SearchOperatorChips = ({
  operators,
  onRemove,
}: {
  operators: BookmarkQueryOperator[]
  onRemove: (token: string) => void
}) => {
  if (operators.length === 0) {
    return null
  }

  return (
    <div className="col-span-full flex flex-wrap gap-2 pt-1">
      {operators.map((op, index) => (
        <Badge key={`${op.token}-${index}`} variant="secondary" className="gap-1.5">
          {op.token}
          <button
            type="button"
            aria-label={`Remove ${op.token} filter`}
            onClick={() => onRemove(op.token)}
            className="inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <XIcon size={12} weight="bold" />
          </button>
        </Badge>
      ))}
    </div>
  )
}
