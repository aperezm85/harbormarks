import { useState } from "react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ArrowsClockwiseIcon,
  BookmarkSimpleIcon,
  LinkIcon,
} from "@phosphor-icons/react"
import { ButtonGroup } from "../ui/button-group"
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group"
import { Textarea } from "../ui/textarea"

export const CreateBookmarkDialog = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [favicon, setFavicon] = useState("")
  const [tags, setTags] = useState("")
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [metadataError, setMetadataError] = useState("")
  const [submitError, setSubmitError] = useState("")

  function resetForm() {
    setUrl("")
    setTitle("")
    setDescription("")
    setFavicon("")
    setTags("")
    setMetadataError("")
    setSubmitError("")
  }

  function handleOpenChange(nextOpen: boolean) {
    setIsOpen(nextOpen)

    if (!nextOpen) {
      resetForm()
    }
  }

  async function handleFetchMetadata() {
    if (!url.trim()) {
      setMetadataError("Enter a URL first.")
      return
    }

    setIsFetchingMetadata(true)
    setMetadataError("")

    try {
      const response = await fetch(
        `/api/bookmarks/metadata?url=${encodeURIComponent(url.trim())}`
      )
      const payload = await response.json()

      if (!response.ok) {
        const errorMessage =
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to fetch metadata."
        throw new Error(errorMessage)
      }

      const metadata = payload?.data
      if (typeof metadata?.title === "string") {
        setTitle(metadata.title)
      }

      if (typeof metadata?.description === "string") {
        setDescription(metadata.description)
      }

      if (typeof metadata?.favicon === "string") {
        setFavicon(metadata.favicon)
      }
    } catch (error) {
      setMetadataError(
        error instanceof Error ? error.message : "Unable to fetch metadata."
      )
    } finally {
      setIsFetchingMetadata(false)
    }
  }

  async function handleSubmit() {
    setSubmitError("")
    setIsSaving(true)

    try {
      const response = await fetch("/api/bookmarks", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          url,
          title,
          description,
          favicon,
          tags,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        const errorMessage =
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to save bookmark."
        throw new Error(errorMessage)
      }

      resetForm()
      setIsOpen(false)
      window.location.reload()
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to save bookmark."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <BookmarkSimpleIcon className="size-4" />
          Add Bookmark
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form
          method="POST"
          className="sm:max-w-sm"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle>Add Bookmark</DialogTitle>
            <DialogDescription>
              Add a new bookmark to your harbor.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="input-group-url">URL</FieldLabel>

              <ButtonGroup>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <LinkIcon />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="input-group-url"
                    name="url"
                    placeholder="https://example.com"
                    required
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                  />
                </InputGroup>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleFetchMetadata}
                  disabled={isFetchingMetadata || isSaving}
                >
                  <ArrowsClockwiseIcon />
                  {isFetchingMetadata ? "Fetching..." : "Fetch"}
                </Button>
              </ButtonGroup>
              {metadataError ? (
                <p className="text-sm text-destructive">{metadataError}</p>
              ) : null}
            </Field>
            <Field>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                placeholder="Enter title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Notes about this bookmark.."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                name="tags"
                placeholder="Comma separated tags, e.g. news, tech, etc."
                value={tags}
                onChange={(event) => setTags(event.target.value)}
              />
            </Field>
            <input type="hidden" name="favicon" value={favicon} />
          </FieldGroup>
          {submitError ? (
            <p className="text-sm text-destructive">{submitError}</p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isSaving}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSaving}>
              <BookmarkSimpleIcon className="size-4" />
              {isSaving ? "Saving..." : "Save Bookmark"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
