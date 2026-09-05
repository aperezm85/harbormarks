import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { latestChanges } from "@/lib/changelog"
import { useState } from "react"

export const LatestChangesDialog = ({ version }: { version: string }) => {
  const [isOpen, setIsOpen] = useState(false)

  function handleOpenChange(nextOpen: boolean) {
    setIsOpen(nextOpen)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <span className="ml-auto cursor-pointer rounded-full bg-sidebar-accent px-2 py-0.5 text-[10px] font-medium text-sidebar-foreground/70">
          {version}
        </span>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Latest changes</DialogTitle>
          <DialogDescription>
            See what has recently changed in HarborMarks.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto pr-1">
          <div className="space-y-4">
            {latestChanges.map((entry) => (
              <section
                key={`${entry.version}-${entry.date}`}
                className="rounded-lg border p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="font-medium">{entry.version}</h3>
                  <p className="text-xs text-muted-foreground">{entry.date}</p>
                </div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {entry.changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
