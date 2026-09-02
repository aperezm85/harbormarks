import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ArrowSquareInIcon,
  CheckCircleIcon,
  SpinnerIcon,
} from "@phosphor-icons/react"
import { useRef, useState, type ReactNode } from "react"

type ImportFormat = "auto" | "json" | "csv" | "html"
type DuplicateStrategy = "skip" | "merge-tags" | "create-anyway"

type ImportSummary = {
  imported: number
  skippedDuplicates: number
  mergedTags: number
  failed: Array<{ line: number; url: string | null; reason: string }>
}

const FORMAT_OPTIONS: Array<{ value: ImportFormat; label: string }> = [
  { value: "auto", label: "Auto-detect" },
  { value: "json", label: "HarborMarks JSON" },
  { value: "csv", label: "CSV (Pocket, generic)" },
  { value: "html", label: "Netscape HTML" },
]

const DUPLICATE_OPTIONS: Array<{
  value: DuplicateStrategy
  label: string
  description: string
 }> = [
 {
   value: "skip",
   label: "Skip duplicates",
   description: "Leave existing bookmarks untouched.",
 },
 {
   value: "merge-tags",
   label: "Merge tags",
   description: "Keep existing bookmarks, adding only the new tags.",
 },
 {
   value: "create-anyway",
   label: "Create anyway",
   description: "Add a new bookmark even if the URL already exists.",
 },
]

const VISIBLE_FAILURES = 20

export const ImportBookmarksDialog = ({
   trigger,
   open,
   onOpenChange,
}: {
   trigger?: ReactNode
   open?: boolean
   onOpenChange?: (open: boolean) => void
}) => {
    // The dashboard listens for this to refresh its list after an import.
   const handleImported = () => {
     window.dispatchEvent(new CustomEvent("harbormarks:bookmarks-changed"))
     }
   const [internalOpen, setInternalOpen] = useState(false)
    // When embedded in a menu, the parent controls open/close; otherwise the
    // dialog owns its own state via the trigger.
   const isControlled = open !== undefined
   const isOpen = isControlled ? open : internalOpen
   const [format, setFormat] = useState<ImportFormat>("auto")
   const [duplicates, setDuplicates] = useState<DuplicateStrategy>("skip")
   const [file, setFile] = useState<File | null>(null)
   const [isImporting, setIsImporting] = useState(false)
   const [error, setError] = useState("")
   const [summary, setSummary] = useState<ImportSummary | null>(null)
   const fileInput = useRef<HTMLInputElement>(null)

   function handleOpenChange(nextOpen: boolean) {
     if (!isControlled) {
        setInternalOpen(nextOpen)
         }

     onOpenChange?.(nextOpen)

     if (!nextOpen) {
       setFile(null)
       setSummary(null)
       setError("")
       if (fileInput.current) {
          fileInput.current.value = ""
           }
       }
     }

  async function handleSubmit() {
    if (!file || isImporting) {
      return
    }

    setIsImporting(true)
    setError("")
    setSummary(null)

    try {
      const body = new FormData()
      body.append("file", file)
      body.append("format", format)
      body.append("duplicates", duplicates)

      const response = await fetch("/api/bookmarks/import", {
        method: "POST",
        body,
        credentials: "same-origin",
       })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
           ? payload.error
           : "The import failed."
         )
       }

      setSummary(payload.data as ImportSummary)
      handleImported()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The import failed.")
      } finally {
      setIsImporting(false)
      }
  }

   return (
     <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        {isControlled ? null : (
        <DialogTrigger asChild>
          {trigger ?? (
              <Button variant="ghost" className="h-auto w-full justify-start">
              <ArrowSquareInIcon className="size-4" />
              <span className="ml-2">Import bookmarks</span>
            </Button>
          )}
        </DialogTrigger>
        )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import bookmarks</DialogTitle>
          <DialogDescription>
           Import a file from another bookmark manager.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="import-file">File</FieldLabel>
            <input
              id="import-file"
              type="file"
              ref={fileInput}
              accept=".json,.csv,.html,.htm,text/html,application/json"
              className="text-sm"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
             />
            {file ? (
              <p className="mt-1 text-xs text-muted-foreground">{file.name}</p>
             ) : null}
          </Field>
          <Field>
            <FieldLabel>Format</FieldLabel>
            <Select
              value={format}
              onValueChange={(value) => setFormat(value as ImportFormat)}
             >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a format" />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Duplicates</FieldLabel>
            <div className="flex flex-col gap-2">
              {DUPLICATE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-2 text-sm"
                 >
                <input
                  type="radio"
                  name="duplicates"
                  value={option.value}
                  checked={duplicates === option.value}
                  onChange={() => setDuplicates(option.value)}
                  className="mt-0.5"
                 />
                  <span>
                    {option.label}
                    <span className="block text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </Field>
        </FieldGroup>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {summary ? (
            <div className="rounded-md border p-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircleIcon className="size-4 text-green-600" />
              Imported {summary.imported}
              {summary.mergedTags > 0
                   ? `, merged ${summary.mergedTags}`
                   : ""}
              {summary.skippedDuplicates > 0
                   ? `, skipped ${summary.skippedDuplicates} duplicate(s)`
                   : ""}
            </div>
            {summary.failed.length > 0 ? (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">
                  {summary.failed.length} row(s) failed:
                </p>
                <ul className="mt-1 space-y-1 text-xs">
                  {summary.failed.slice(0, VISIBLE_FAILURES).map((failure) => (
                    <li
                      key={`${failure.line}-${failure.url ?? ""}`}
                      className="truncate text-muted-foreground"
                     >
                    Line {failure.line}: {failure.reason}
                    </li>
                  ))}
                </ul>
                {summary.failed.length > VISIBLE_FAILURES ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    …and {summary.failed.length - VISIBLE_FAILURES} more.
                  </p>
                ) : null}
              </div>
            ) : null}
            </div>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isImporting}>
              Close
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={!file || isImporting}
            onClick={() => void handleSubmit()}
           >
            {isImporting ? (
              <SpinnerIcon
               className="size-4 animate-spin"
               data-icon="inline-start"
              />
            ) : (
              <ArrowSquareInIcon
               className="size-4"
               data-icon="inline-start"
              />
            )}
            {isImporting ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
