import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useLocalStorageValue } from "@/hooks/use-local-storage"
import { latestChanges } from "@/lib/changelog"
import { MegaphoneIcon } from "@phosphor-icons/react"
import { useState } from "react"

const CHANGELOG_SEEN_STORAGE_KEY = "harbormarks:last-seen-changelog-version"

export const LatestChangesDialog = () => {
  const [isOpen, setIsOpen] = useState(false)
  const latestVersion = latestChanges[0]?.version ?? ""

  // The "last seen version" lives in localStorage, which is an external store.
  // Reading it through useSyncExternalStore means the first client render uses
  // the server snapshot (null) and matches the server HTML, so the persisted
  // value syncs in after hydration instead of causing a mismatch.
  const seenVersion = useLocalStorageValue(CHANGELOG_SEEN_STORAGE_KEY)

  // A dismiss within this tab does not fire a `storage` event (those only
  // cross tabs), so track it in a constant-initialized state that is identical
  // on server and client and therefore hydration-safe.
  const [isDismissedThisSession, setIsDismissedThisSession] = useState(false)
  const hasUnseenChanges =
    Boolean(latestVersion) &&
    seenVersion !== latestVersion &&
    !isDismissedThisSession

  function handleOpenChange(nextOpen: boolean) {
    setIsOpen(nextOpen)

    if (nextOpen && latestVersion) {
      // Opening the dialog is the user event that dismisses it, so persist and
      // update locally there rather than in an effect.
      window.localStorage.setItem(CHANGELOG_SEEN_STORAGE_KEY, latestVersion)
      setIsDismissedThisSession(true)
      }
    }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="group relative h-auto w-full justify-start overflow-hidden rounded-xl border border-primary/20 bg-linear-to-r from-primary/15 via-primary/5 to-transparent px-3 py-2.5 text-left transition-all hover:border-primary/35 hover:from-primary/25 hover:to-primary/10 hover:shadow-sm"
        >
          <span className="absolute inset-y-0 left-0 w-1 bg-primary/70" />

          <div className="flex w-full items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/90 ring-1 ring-primary/20 transition-transform duration-150 group-hover:scale-105">
              <MegaphoneIcon className="size-4 -scale-x-100 transform text-primary" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Latest changes</p>
              <p className="truncate text-xs text-muted-foreground">
                {latestVersion
                  ? `See what is new in ${latestVersion}`
                  : "See what is new"}
              </p>
            </div>

            {hasUnseenChanges ? (
              <Badge
                variant="secondary"
                className="ml-auto h-5 rounded-full bg-primary/15 px-2 text-[10px] font-semibold text-primary ring-1 ring-primary/25"
              >
                New
              </Badge>
            ) : null}
          </div>
        </Button>
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
