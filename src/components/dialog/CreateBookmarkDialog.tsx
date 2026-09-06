import type { BookmarkCardData, BookmarkStatus } from "@/lib/bookmark-types"
import { useCallback, useState, type ReactNode } from "react"

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
import { normalizeBookmarkUrl } from "@/lib/bookmark-url"
import {
  ArrowsClockwiseIcon,
  BookmarkSimpleIcon,
  CaretDownIcon,
  LinkIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"
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
  siteName?: string | null
  author?: string | null
  publishedAt?: string | null
  language?: string | null
  canonicalUrl?: string | null
  // Story 12 notes-only slice: private user note.
  note?: string | null
  // Read status slice: carried through so edit saves preserve it.
  status?: BookmarkStatus | null
  isFavorite?: boolean | null
  createdAt?: string | null
  visitCount?: number | null
}

type BookmarkMetadataPayload = {
  title?: string
  description?: string
  favicon?: string
  previewImage?: string | null
  siteName?: string | null
  author?: string | null
  publishedAt?: string | null
  language?: string | null
  canonicalUrl?: string | null
}

type CreateBookmarkDialogProps = {
  bookmark?: EditableBookmark
  trigger?: ReactNode
  onSaved?: (bookmark: BookmarkCardData) => void
  preselectedTags?: string[]
  defaultFavorite?: boolean
}

function monogram(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean)

  if (words.length === 0) {
    return "HB"
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }

  return (words[0][0] + words[1][0]).toUpperCase()
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function timeAgo(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return "unknown"
  }

  const then = Date.parse(isoDate)

  if (Number.isNaN(then)) {
    return "unknown"
  }

  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))

  if (seconds < 60) {
    return "just now"
  }

  const minutes = Math.floor(seconds / 60)

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours}h ago`
  }

  const days = Math.floor(hours / 24)

  if (days < 30) {
    return `${days}d ago`
  }

  const months = Math.floor(days / 30)

  if (months < 12) {
    return `${months}mo ago`
  }

  return `${Math.floor(months / 12)}y ago`
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
  // Story 12 notes-only slice: private user note, free text.
  const [note, setNote] = useState("")
  const [favicon, setFavicon] = useState("")
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [isTagSuggestionsOpen, setIsTagSuggestionsOpen] = useState(false)
  const [existingTags, setExistingTags] = useState<string[]>([])
  const [isLoadingTags, setIsLoadingTags] = useState(false)
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false)
  const [hasFetchedMetadata, setHasFetchedMetadata] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPreviewThumbBroken, setIsPreviewThumbBroken] = useState(false)
  const [metadataError, setMetadataError] = useState("")
  const [submitError, setSubmitError] = useState("")
  const [statusMessage, setStatusMessage] = useState("")
  const [siteName, setSiteName] = useState<string | null>(null)
  const [author, setAuthor] = useState<string | null>(null)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [language, setLanguage] = useState<string | null>(null)
  const [canonicalUrl, setCanonicalUrl] = useState<string | null>(null)
  // Save mode: favorite switch, default OFF (persisted as isFavorite).
  const [saveIsFavorite, setSaveIsFavorite] = useState(defaultFavorite)
  // Edit mode: segmented status (Read maps to the "reading" DB value) and
  // favorite switch, both persisted through the update payload.
  const [editStatus, setEditStatus] = useState<BookmarkStatus>("unread")
  const [editIsFavorite, setEditIsFavorite] = useState(false)
  const isEditMode = Boolean(bookmark)
  const isPending = isFetchingMetadata || isSaving

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
      setNote(values?.note ?? "")
      setFavicon(values?.favicon ?? "")
      setPreviewImage(values?.previewImage ?? null)
      setSelectedTags(values?.tags ?? preselectedTags ?? [])
      setSiteName(values?.siteName ?? null)
      setAuthor(values?.author ?? null)
      setPublishedAt(values?.publishedAt ?? null)
      setLanguage(values?.language ?? null)
      setCanonicalUrl(values?.canonicalUrl ?? null)
      setTagInput("")
      setIsTagSuggestionsOpen(false)
      setMetadataError("")
      setSubmitError("")
      setHasFetchedMetadata(false)
      setSaveIsFavorite(defaultFavorite)
      setIsPreviewThumbBroken(false)
      setEditStatus(values?.status ?? "unread")
      setEditIsFavorite(values?.isFavorite ?? false)
    },
    [preselectedTags, defaultFavorite]
  )

  function resetForm() {
    applyBookmarkValues(bookmark)
    setStatusMessage("")
  }

  // Seeding the fields and loading tag suggestions both happen because the user
  // opened the dialog, so they belong in the event handler rather than an effect
  // that re-derives them from isOpen. The dialog is only ever opened through here.
  function handleOpenChange(nextOpen: boolean) {
    setIsOpen(nextOpen)

    if (nextOpen) {
      applyBookmarkValues(bookmark)
      void fetchExistingTags()
      return
    }

    resetForm()
  }

  async function handleFetchMetadata() {
    if (!url.trim()) {
      setMetadataError("Enter a URL first.")
      setStatusMessage("Enter a URL first.")
      return
    }

    setIsFetchingMetadata(true)
    setMetadataError("")
    setStatusMessage("Fetching page metadata...")

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

      setSiteName(
        typeof metadata?.siteName === "string" ? metadata.siteName : null
      )
      setAuthor(typeof metadata?.author === "string" ? metadata.author : null)
      setPublishedAt(
        typeof metadata?.publishedAt === "string" ? metadata.publishedAt : null
      )
      setLanguage(
        typeof metadata?.language === "string" ? metadata.language : null
      )
      setCanonicalUrl(
        typeof metadata?.canonicalUrl === "string"
          ? metadata.canonicalUrl
          : null
      )

      // A re-fetch updates title/description/metadata only — note and tags are
      // never touched.
      setHasFetchedMetadata(true)
      setIsPreviewThumbBroken(false)
      setStatusMessage("Metadata fetched and fields updated.")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to fetch metadata."
      setMetadataError(message)
      setStatusMessage(message)
    } finally {
      setIsFetchingMetadata(false)
    }
  }

  async function handleSubmit(form?: HTMLFormElement) {
    if (isSaving) {
      return
    }

    if (form && !form.reportValidity()) {
      return
    }

    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      setSubmitError("URL is required.")
      setStatusMessage("URL is required.")
      return
    }

    const normalizedUrl = normalizeBookmarkUrl(trimmedUrl)
    if (!normalizedUrl) {
      setSubmitError("Enter a valid http or https URL.")
      setStatusMessage("Enter a valid http or https URL.")
      return
    }

    if (!title.trim()) {
      setSubmitError("Title is required.")
      setStatusMessage("Title is required.")
      return
    }

    setSubmitError("")
    setIsSaving(true)
    setStatusMessage(
      isEditMode ? "Saving bookmark changes..." : "Saving bookmark..."
    )

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
          url: normalizedUrl,
          title: title.trim(),
          description: description.trim(),
          favicon,
          previewImage,
          tags: tagsPayload,
          isFavorite: isEditMode ? editIsFavorite : saveIsFavorite,
          // Save mode: new bookmarks always start unread (no status control).
          // Edit mode: the segmented control maps Read -> "reading".
          status: isEditMode ? editStatus : "unread",
          // Story 7 enrichments. Sent as raw strings so the JSON route can
          // apply its own `trim() || null`; empty/null stay null on the way in.
          siteName: siteName ?? undefined,
          author: author ?? undefined,
          publishedAt: publishedAt ?? undefined,
          language: language ?? undefined,
          canonicalUrl: canonicalUrl ?? undefined,
          // Story 12 note: trimmed here; empty collapses to null so "no
          // note" is stored as NULL. Metadata fetch never touches this field.
          note: note.trim() ? note.trim() : null,
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
      setStatusMessage(isEditMode ? "Bookmark updated." : "Bookmark created.")
      if (onSaved) {
        onSaved(savedBookmark)
      } else {
        window.location.reload()
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save bookmark."
      setSubmitError(message)
      setStatusMessage(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!isEditMode || !bookmark || isDeleting || isSaving) {
      return
    }

    const confirmed = window.confirm(
      `Move "${title || bookmark.title}" to Trash? You can restore it from there.`
    )

    if (!confirmed) {
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/bookmarks/${bookmark.id}/delete`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error("Unable to delete bookmark.")
      }

      setIsOpen(false)
      toast.success("Bookmark moved to Trash.")
      window.dispatchEvent(new CustomEvent("harbormarks:bookmarks-changed"))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to delete bookmark."
      setSubmitError(message)
    } finally {
      setIsDeleting(false)
    }
  }

  const tagSuggestions = existingTags.filter((tag) => {
    if (hasTag(tag)) {
      return false
    }

    const query = tagInput.trim().toLowerCase()
    return !query || tag.toLowerCase().includes(query)
  })
  const visibleTagSuggestions = tagSuggestions.slice(0, 8)

  const editSub = isEditMode
    ? `${domainOf(bookmark?.url ?? url)} · saved ${timeAgo(bookmark?.createdAt)} · ${bookmark?.visitCount ?? 0} visits`
    : null

  const renderTagField = (hint: string) => (
    <Field>
      <Label htmlFor="tag-input">Tags</Label>
      {selectedTags.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="h-6 gap-1 pr-1">
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
      <div className="relative">
        <Input
          id="tag-input"
          placeholder="Add a tag…"
          value={tagInput}
          onFocus={() => setIsTagSuggestionsOpen(true)}
          onChange={(event) => {
            setTagInput(event.target.value)
            setIsTagSuggestionsOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault()
              addTag(tagInput)
              setTagInput("")
              setIsTagSuggestionsOpen(false)
            }

            if (
              event.key === "Backspace" &&
              !tagInput &&
              selectedTags.length > 0
            ) {
              event.preventDefault()
              setSelectedTags((current) => current.slice(0, -1))
            }

            if (event.key === "Escape") {
              setIsTagSuggestionsOpen(false)
            }
          }}
          onBlur={() => {
            setTimeout(() => {
              setIsTagSuggestionsOpen(false)
            }, 100)

            if (!tagInput.trim()) {
              return
            }

            addTag(tagInput)
            setTagInput("")
          }}
        />
        <CaretDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
        {isTagSuggestionsOpen && visibleTagSuggestions.length > 0 ? (
          <div className="absolute z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-sm shadow-lg">
            {visibleTagSuggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(event) => {
                  event.preventDefault()
                }}
                onClick={() => {
                  addTag(tag)
                  setTagInput("")
                  setIsTagSuggestionsOpen(false)
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {isLoadingTags ? "Loading tag suggestions..." : hint}
      </p>
    </Field>
  )

  const renderSwitch = (
    checked: boolean,
    onToggle: () => void,
    label: string
  ) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors ${
        checked ? "justify-end bg-primary" : "justify-start bg-muted"
      } ring-1 ring-foreground/10 ring-inset`}
    >
      <span aria-hidden="true" className="size-4 rounded-full bg-background shadow" />
    </button>
  )

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild disabled={isPending}>
        {trigger ?? (
          <Button disabled={isPending}>
            <BookmarkSimpleIcon className="size-4" data-icon="inline-start" />
            <span className="hidden sm:block">Add Bookmark</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="rounded-[0.625rem] sm:max-w-[560px]"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <form
          method="POST"
          className="flex max-h-[85vh] flex-col gap-4"
          aria-busy={isPending}
          onSubmit={(event) => {
            event.preventDefault()
            void handleSubmit(event.currentTarget)
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Edit bookmark" : "Save a link"}
            </DialogTitle>
            <DialogDescription className={isEditMode ? "font-mono" : undefined}>
              {isEditMode
                ? (editSub ?? "Update bookmark details in your harbor.")
                : "Metadata is fetched and stored locally — no hotlinking back to the source."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-0.5">
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
                      type="url"
                      placeholder="https://example.com"
                      required
                      spellCheck={false}
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                    />
                  </InputGroup>
                  {isEditMode ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleFetchMetadata}
                      disabled={isPending}
                      title="Re-fetch metadata (never overwrites your note or tags)"
                      aria-label="Re-fetch metadata"
                    >
                      <ArrowsClockwiseIcon
                        className={isFetchingMetadata ? "animate-spin" : undefined}
                      />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleFetchMetadata}
                      disabled={isPending}
                    >
                      <ArrowsClockwiseIcon data-icon="inline-start" />
                      {isFetchingMetadata ? "Fetching..." : "Fetch"}
                    </Button>
                  )}
                </ButtonGroup>
                {metadataError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {metadataError}
                  </p>
                ) : null}
              </Field>
              {/* Proto preview-row: image (previewImage, favicon fallback,
                  monogram fallback) + title + 2-line description, shown once
                  metadata has been fetched in save mode. */}
              {!isEditMode && hasFetchedMetadata && title.trim() ? (
                <div className="flex items-center gap-3 rounded-[0.625rem] border border-dashed border-border p-3">
                  {previewImage?.trim() || favicon?.trim() ? (
                    isPreviewThumbBroken ? (
                      <div
                        aria-hidden="true"
                        className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs font-semibold text-muted-foreground"
                      >
                        {monogram(title)}
                      </div>
                    ) : (
                      <img
                        src={previewImage?.trim() ? previewImage : favicon}
                        alt={`${title.trim()} preview`}
                        className="size-10 shrink-0 rounded-md object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={() => setIsPreviewThumbBroken(true)}
                      />
                    )
                  ) : (
                    <div
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs font-semibold text-muted-foreground"
                    >
                      {monogram(title)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{title.trim()}</p>
                    {description.trim() ? (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {description.trim()}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <Field>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="Enter title"
                  required
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
                {isEditMode ? (
                  <p className="text-xs text-muted-foreground">
                    Scraped from the page. Rewrite it when the site&apos;s meta
                    description is useless.
                  </p>
                ) : null}
              </Field>
              <Field>
                <Label htmlFor="note">Your note</Label>
                <Textarea
                  id="note"
                  name="note"
                  placeholder="Why did you save this? (only you see this)"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                {isEditMode ? (
                  <p className="text-xs text-muted-foreground">
                    Private, searchable, and never overwritten by a re-fetch.
                  </p>
                ) : null}
              </Field>
              {renderTagField(
                isEditMode
                  ? "Enter to add · Backspace on an empty field removes the last one."
                  : "Choose an existing tag or type a new one."
              )}
              {isEditMode ? (
                <Field>
                  <Label>Status</Label>
                  <div
                    className="flex gap-1"
                    role="group"
                    aria-label="Reading status"
                  >
                    {(
                      [
                        { value: "unread", label: "Unread" },
                        { value: "reading", label: "Read" },
                        { value: "archived", label: "Archived" },
                      ] as const
                    ).map((option) => {
                      const isActive = editStatus === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => setEditStatus(option.value)}
                          className={`h-8 flex-1 rounded-[0.625rem] text-xs font-medium transition-colors ring-1 ring-foreground/10 ring-inset ${
                            isActive
                              ? option.value === "unread"
                                ? "bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-400"
                                : "bg-primary text-primary-foreground"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </Field>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-[0.625rem] ring-1 ring-foreground/10 ring-inset px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Add to favourites</p>
                    <p className="text-xs text-muted-foreground">
                      Pins it to the Favorites view.
                    </p>
                  </div>
                  {renderSwitch(saveIsFavorite, () => setSaveIsFavorite((v) => !v), "Add to favourites")}
                </div>
              )}
              {isEditMode ? (
                <div className="flex items-center justify-between gap-3 rounded-[0.625rem] ring-1 ring-foreground/10 ring-inset px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Favorite</p>
                    <p className="text-xs text-muted-foreground">
                      Pins it to the Favorites view.
                    </p>
                  </div>
                  {renderSwitch(
                    editIsFavorite,
                    () => setEditIsFavorite((v) => !v),
                    "Favorite"
                  )}
                </div>
              ) : null}
              <input type="hidden" name="favicon" value={favicon} />
              {/* Story 7 enrichments stay under Advanced so no stored value is
                  lost when editing. */}
              <details className="group w-full">
                <summary
                  className="cursor-pointer text-sm font-medium select-none"
                  aria-label="Advanced bookmark metadata"
                  onClick={(event) => event.stopPropagation()}
                >
                  Advanced
                </summary>
                <div className="mt-2 flex flex-col gap-3 border-t pt-2">
                  <Field>
                    <Label htmlFor="advanced-author">Author</Label>
                    <Input
                      id="advanced-author"
                      name="author"
                      placeholder="Author name"
                      value={author ?? ""}
                      onChange={(event) =>
                        setAuthor(event.target.value || null)
                      }
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="advanced-published-at">Published</Label>
                    <Input
                      id="advanced-published-at"
                      name="publishedAt"
                      placeholder="YYYY-MM-DD or ISO date"
                      value={publishedAt ?? ""}
                      onChange={(event) =>
                        setPublishedAt(event.target.value || null)
                      }
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="advanced-language">Language</Label>
                    <Input
                      id="advanced-language"
                      name="language"
                      placeholder="e.g. en or es"
                      value={language ?? ""}
                      onChange={(event) =>
                        setLanguage(event.target.value || null)
                      }
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="advanced-canonical-url">
                      Canonical URL
                    </Label>
                    <Input
                      id="advanced-canonical-url"
                      name="canonicalUrl"
                      type="url"
                      placeholder="https://example.com/canonical"
                      value={canonicalUrl ?? ""}
                      onChange={(event) =>
                        setCanonicalUrl(event.target.value || null)
                      }
                    />
                  </Field>
                </div>
              </details>
            </FieldGroup>
          </div>
          {submitError ? (
            <p className="text-sm text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}
          <p className="sr-only" role="status" aria-live="polite">
            {statusMessage}
          </p>
          {isPending && (
            <p
              className="text-xs text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              {isSaving ? "Saving bookmark..." : "Fetching metadata..."}
            </p>
          )}
          <DialogFooter className="sm:justify-between">
            {isEditMode ? (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                disabled={isSaving || isDeleting}
                onClick={() => void handleDelete()}
              >
                <TrashIcon data-icon="inline-start" />
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSaving}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSaving}>
                {isSaving && (
                  <ArrowsClockwiseIcon
                    className="size-4 animate-spin"
                    data-icon="inline-start"
                  />
                )}
                {isSaving
                  ? "Saving..."
                  : isEditMode
                    ? "Save changes"
                    : "Save link"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
