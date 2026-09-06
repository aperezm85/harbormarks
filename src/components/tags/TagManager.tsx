import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

type TagSummary = {
  tag: string
  count: number
}

export function TagManager() {
  const [tags, setTags] = React.useState<TagSummary[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [query, setQuery] = React.useState("")
  const [editing, setEditing] = React.useState<string | null>(null)
  const [editValue, setEditValue] = React.useState("")
  const [mergeTarget, setMergeTarget] = React.useState<Record<string, string>>({})
  const [isWorking, setIsWorking] = React.useState(false)

  const load = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/bookmarks/tags")
      const payload = (await response.json()) as { data?: TagSummary[] }
      if (!response.ok) {
        throw new Error("Unable to load tags.")
      }
      setTags(payload.data ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load tags.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    // Initial tag load on mount: sanctioned set-state-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  async function runAction(body: Record<string, string>) {
    setIsWorking(true)
    try {
      const response = await fetch("/api/bookmarks/tags/manage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as {
        data?: { updated?: number }
        error?: string
      }
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string" ? payload.error : "Action failed."
        )
      }
      toast.success(`Updated ${payload.data?.updated ?? 0} bookmark(s).`)
      window.dispatchEvent(new CustomEvent("harbormarks:tags-changed"))
      window.dispatchEvent(new CustomEvent("harbormarks:bookmarks-changed"))
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed.")
    } finally {
      setIsWorking(false)
    }
  }

  const visible = tags.filter((t) =>
    t.tag.toLowerCase().includes(query.trim().toLowerCase())
  )

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Manage tags</h1>
        <p className="text-sm text-muted-foreground">
          Rename a tag everywhere, merge one tag into another, or remove a tag
          from all bookmarks. Changes apply to your bookmarks only.
        </p>
      </div>
      <Input
        placeholder="Filter tags..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading tags...</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tags found.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((t) => (
            <li
              key={t.tag}
              className="rounded-lg border p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-medium">{t.tag}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {t.count} bookmark{t.count === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isWorking}
                    onClick={() => {
                      setEditing(t.tag)
                      setEditValue(t.tag)
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isWorking}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove tag "${t.tag}" from all bookmarks?`
                        )
                      ) {
                        void runAction({ action: "delete", tag: t.tag })
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              {editing === t.tag ? (
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    setEditing(null)
                    void runAction({ action: "rename", from: t.tag, to: editValue })
                  }}
                >
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="New tag name"
                  />
                  <Button type="submit" size="sm" disabled={isWorking}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </Button>
                </form>
              ) : null}
              <form
                className="mt-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const target = (mergeTarget[t.tag] ?? "").trim()
                  if (!target) {
                    return
                  }
                  void runAction({
                    action: "merge",
                    source: t.tag,
                    target,
                  })
                }}
              >
                <Input
                  value={mergeTarget[t.tag] ?? ""}
                  onChange={(e) =>
                    setMergeTarget((m) => ({ ...m, [t.tag]: e.target.value }))
                  }
                  placeholder={`Merge "${t.tag}" into...`}
                />
                <Button type="submit" size="sm" variant="outline" disabled={isWorking}>
                  Merge
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
