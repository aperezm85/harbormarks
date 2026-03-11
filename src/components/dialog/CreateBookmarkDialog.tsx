import type { BookmarkCardData } from "@/lib/bookmarks"
import { useCallback, useEffect, useState, type ReactNode } from "react"

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
  XIcon,
} from "@phosphor-icons/react"
import { Badge } from "../ui/badge"
import { ButtonGroup } from "../ui/button-group"
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group"
import { Textarea } from "../ui/textarea"

type EditableBookmark = {
  id: string
  url: string
  title: string
  description: string
  favicon: string
  previewImage: string | null
  tags: string[]
}

type BookmarkMetadataPayload = {
  title?: string
  description?: string
  favicon?: string
  previewImage?: string | null
}

type CreateBookmarkDialogProps = {
  bookmark?: EditableBookmark
  trigger?: ReactNode
  onSaved?: (bookmark: BookmarkCardData) => void
  preselectedTags?: string[]
  defaultFavorite?: boolean
}

export const CreateBookmarkDialog = ({
  bookmark,
  trigger,
  onSaved,
  preselectedTags,
  defaultFavorite = false,
}: CreateBookmarkDialogProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [favicon, setFavicon] = useState("")
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [existingTags, setExistingTags] = useState<string[]>([])
  const [isLoadingTags, setIsLoadingTags] = useState(false)
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [metadataError, setMetadataError] = useState("")
  const [submitError, setSubmitError] = useState("")
  const isEditMode = Boolean(bookmark)

  function hasTag(tag: string) {
    const normalized = tag.toLowerCase()
    return selectedTags.some(
      (selected) => selected.toLowerCase() === normalized
    )
  }

  function addTag(rawTag: string) {
    const nextTag = rawTag.trim()
    if (!nextTag || hasTag(nextTag)) {
      return
    }

    setSelectedTags((current) => [...current, nextTag])
  }

  function removeTag(tagToRemove: string) {
    const normalized = tagToRemove.toLowerCase()
    setSelectedTags((current) =>
      current.filter((tag) => tag.toLowerCase() !== normalized)
    )
  }

  async function fetchExistingTags() {
    setIsLoadingTags(true)

    try {
      const response = await fetch("/api/bookmarks/tags")
      const payload: unknown = await response.json()

      if (!response.ok) {
        throw new Error("Unable to load existing tags.")
      }

      if (
        typeof payload === "object" &&
        payload !== null &&
        "data" in payload &&
        Array.isArray(payload.data)
      ) {
        setExistingTags(
          payload.data
            .map((tag: unknown) => {
              if (typeof tag === "string") {
                return tag
              }

              if (
                typeof tag === "object" &&
                tag !== null &&
                "tag" in tag &&
                typeof tag.tag === "string"
              ) {
                return tag.tag
              }

              return null
            })
            .filter((tag): tag is string => Boolean(tag))
        )
      }
    } catch {
      // Keep form usable even if suggestions cannot be loaded.
      setExistingTags([])
    } finally {
      setIsLoadingTags(false)
    }
  }

  const applyBookmarkValues = useCallback(
    (values?: EditableBookmark) => {
      setUrl(values?.url ?? "")
      setTitle(values?.title ?? "")
      setDescription(values?.description ?? "")
      setFavicon(values?.favicon ?? "")
      setPreviewImage(values?.previewImage ?? null)
      setSelectedTags(values?.tags ?? preselectedTags ?? [])
      setTagInput("")
      setMetadataError("")
      setSubmitError("")
    },
    [preselectedTags]
  )

  function resetForm() {
    applyBookmarkValues(bookmark)
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }

    applyBookmarkValues(bookmark)
    void fetchExistingTags()
  }, [applyBookmarkValues, bookmark, isOpen])

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
      const payload = (await response.json()) as {
        data?: BookmarkMetadataPayload
        error?: string
      }

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

      setPreviewImage(
        typeof metadata?.previewImage === "string"
          ? metadata.previewImage
          : null
      )
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

    const pendingTag = tagInput.trim()
    const tagsPayload = pendingTag
      ? hasTag(pendingTag)
        ? selectedTags
        : [...selectedTags, pendingTag]
      : selectedTags

    try {
      const endpoint = isEditMode
        ? `/api/bookmarks/${bookmark?.id}/update`
        : "/api/bookmarks"

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          url,
          title,
          description,
          favicon,
          previewImage,
          tags: tagsPayload,
          isFavorite: !isEditMode && defaultFavorite,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        const errorMessage =
          typeof payload.error === "string"
            ? payload.error
            : "Unable to save bookmark."
        throw new Error(errorMessage)
      }

      const savedBookmark = payload.data
      if (!savedBookmark) {
        throw new Error("Unable to save bookmark.")
      }

      applyBookmarkValues(bookmark)
      setIsOpen(false)
      if (onSaved) {
        onSaved(savedBookmark)
      } else {
        window.location.reload()
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to save bookmark."
      )
    } finally {
      setIsSaving(false)
    }
  }

  const tagSuggestions = existingTags.filter((tag) => {
    if (hasTag(tag)) {
      return false
    }

    const query = tagInput.trim().toLowerCase()
    return !query || tag.toLowerCase().includes(query)
  })

  const tagsDatalistId = "bookmark-tag-suggestions"

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <BookmarkSimpleIcon className="size-4" />
            <span className="hidden sm:block">Add Bookmark</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form
          method="POST"
          className="flex flex-col gap-4 sm:max-w-sm"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Edit Bookmark" : "Add Bookmark"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Update bookmark details in your harbor."
                : "Add a new bookmark to your harbor."}
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
              <Label htmlFor="tag-input">Tags</Label>
              {selectedTags.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  {selectedTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="h-6 gap-1 pr-1"
                    >
                      {tag}
                      <button
                        type="button"
                        className="inline-flex size-4 items-center justify-center rounded-full hover:bg-black/10"
                        onClick={() => removeTag(tag)}
                        aria-label={`Remove ${tag} tag`}
                      >
                        <XIcon className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : null}
              <Input
                id="tag-input"
                placeholder="Type a tag and press Enter"
                value={tagInput}
                list={tagsDatalistId}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault()
                    addTag(tagInput)
                    setTagInput("")
                  }

                  if (
                    event.key === "Backspace" &&
                    !tagInput &&
                    selectedTags.length > 0
                  ) {
                    event.preventDefault()
                    setSelectedTags((current) => current.slice(0, -1))
                  }
                }}
                onBlur={() => {
                  if (!tagInput.trim()) {
                    return
                  }

                  addTag(tagInput)
                  setTagInput("")
                }}
              />
              <datalist id={tagsDatalistId}>
                {tagSuggestions.map((tag) => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                {isLoadingTags
                  ? "Loading tag suggestions..."
                  : "Choose an existing tag or type a new one."}
              </p>
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
              {isSaving
                ? "Saving..."
                : isEditMode
                  ? "Save Changes"
                  : "Save Bookmark"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
