import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { normalizeBookmarkUrl } from "@/lib/bookmark-url"
import type { BookmarkCardData } from "@/lib/bookmark-types"

type QuickSaveProps = {
  url: string
  initialTitle: string
  initialDescription: string
  initialTags: string[]
  initialNote: string
}

type MetadataPayload = {
  title?: string
  description?: string
  favicon?: string
  previewImage?: string | null
  siteName?: string | null
  author?: string | null
  publishedAt?: string | null
  language?: string | null
  canonicalUrl?: string | null
  tags?: string[]
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function cleanTags(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return []
  }
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    if (typeof value !== "string") {
      continue
    }
    const trimmed = value.trim()
    if (!trimmed) {
      continue
    }
    const key = trimmed.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push(trimmed)
    if (out.length >= 8) {
      break
    }
  }
  return out
}

export function QuickSave({
  url,
  initialTitle,
  initialDescription,
  initialTags,
  initialNote,
}: QuickSaveProps) {
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [tagsText, setTagsText] = useState(() => initialTags.join(", "))
  const [note, setNote] = useState(initialNote)
  const [isFavorite, setIsFavorite] = useState(false)
  const [favicon, setFavicon] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [siteName, setSiteName] = useState<string | null>(null)
  const [author, setAuthor] = useState<string | null>(null)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [language, setLanguage] = useState<string | null>(null)
  const [canonicalUrl, setCanonicalUrl] = useState<string | null>(null)
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(
    () => !initialTitle.trim()
  )
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState<BookmarkCardData | null>(null)
  const [duplicate, setDuplicate] =
    useState<BookmarkCardData | null>(null)
  const [error, setError] = useState("")
  const [thumbBroken, setThumbBroken] = useState(false)
  // Fill-only-if-empty: metadata never overwrites text the user typed while
  // the fetch was in flight (same rule as the desktop save dialog).
  const titleEditedRef = useRef(false)
  const tagsEditedRef = useRef(false)

  // Server-fetch title/description when the Shortcut only sent a URL. State
  // updates happen in promise continuations only, never synchronously in the
  // effect body.
  useEffect(() => {
    if (initialTitle.trim()) {
      return
    }
    let cancelled = false
    void fetch(`/api/bookmarks/metadata?url=${encodeURIComponent(url)}`)
      .then(async (response) => {
        if (cancelled) {
          return
        }
        const payload = (await response.json().catch(() => null)) as {
          data?: MetadataPayload
        } | null
        const metadata = response.ok ? payload?.data : undefined
        if (metadata) {
          if (typeof metadata.title === "string" && metadata.title) {
            if (!titleEditedRef.current) {
              setTitle(metadata.title)
            }
          }
          if (typeof metadata.description === "string") {
            setDescription(metadata.description)
          }
          if (typeof metadata.favicon === "string") {
            setFavicon(metadata.favicon)
          }
          if (typeof metadata.previewImage === "string") {
            setPreviewImage(metadata.previewImage)
          }
          if (typeof metadata.siteName === "string") {
            setSiteName(metadata.siteName)
          }
          if (typeof metadata.author === "string") {
            setAuthor(metadata.author)
          }
          if (typeof metadata.publishedAt === "string") {
            setPublishedAt(metadata.publishedAt)
          }
          if (typeof metadata.language === "string") {
            setLanguage(metadata.language)
          }
          if (typeof metadata.canonicalUrl === "string") {
            setCanonicalUrl(metadata.canonicalUrl)
          }
          const suggested = cleanTags(metadata.tags)
          if (
            suggested.length > 0 &&
            initialTags.length === 0 &&
            !tagsEditedRef.current
          ) {
            setTagsText(suggested.join(", "))
          }
        }
        setIsFetchingMetadata(false)
      })
      .catch(() => {
        if (!cancelled) {
          setIsFetchingMetadata(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [url, initialTitle, initialTags.length])

  async function handleSave(event: { preventDefault(): void }) {
    event.preventDefault()
    if (isSaving) {
      return
    }
    const normalized = normalizeBookmarkUrl(url)
    if (!normalized) {
      setError("That link doesn't look like a valid URL.")
      return
    }
    setIsSaving(true)
    setError("")
    try {
      const response = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: normalized,
          title: title.trim() || normalized,
          description: description.trim(),
          favicon,
          previewImage,
          tags: tagsText
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          isFavorite,
          status: "unread",
          siteName: siteName ?? undefined,
          author: author ?? undefined,
          publishedAt: publishedAt ?? undefined,
          language: language ?? undefined,
          canonicalUrl: canonicalUrl ?? undefined,
          note: note.trim() ? note.trim() : null,
        }),
      })
      const payload = (await response.json()) as {
        data?: BookmarkCardData
        error?: string
        code?: string
        existing?: BookmarkCardData
      }
      if (
        response.status === 409 &&
        payload.code === "duplicate_bookmark" &&
        payload.existing
      ) {
        setDuplicate(payload.existing)
        return
      }
      if (!response.ok || !payload.data) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Unable to save bookmark."
        )
      }
      setSaved(payload.data)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save bookmark."
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (saved) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Saved</CardTitle>
          <CardDescription>
            {saved.title || domainOf(saved.url)} is in your library.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              onClick={() => window.open(saved.url, "_blank", "noopener")}
            >
              Open page
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                window.location.href = "/"
              }}
            >
              View in HarborMarks
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (duplicate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Already saved</CardTitle>
          <CardDescription>
            This link is already in your library — nothing new was added.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium break-words">
                {duplicate.title || domainOf(duplicate.url)}
              </p>
              <p className="text-xs break-all text-muted-foreground">
                {duplicate.url}
              </p>
              {duplicate.tags.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {duplicate.tags.join(", ")}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                onClick={() => window.open(duplicate.url, "_blank", "noopener")}
              >
                Open existing
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  window.location.href = "/"
                }}
              >
                Back to HarborMarks
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Save link</CardTitle>
        <CardDescription>
          {domainOf(url)}
          {isFetchingMetadata ? " · fetching title…" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {previewImage && !thumbBroken && (
          <img
            src={previewImage}
            alt=""
            loading="lazy"
            className="mb-3 h-28 w-full rounded-lg border object-cover"
            onError={() => setThumbBroken(true)}
          />
        )}
        <form onSubmit={handleSave} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="quicksave-title">Title</FieldLabel>
              <Input
                id="quicksave-title"
                value={title}
                onChange={(event) => {
                  titleEditedRef.current = true
                  setTitle(event.target.value)
                }}
                placeholder={isFetchingMetadata ? "Fetching title…" : "Link title"}
                maxLength={500}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="quicksave-tags">
                Tags <span className="font-normal">(comma-separated)</span>
              </FieldLabel>
              <Input
                id="quicksave-tags"
                value={tagsText}
                onChange={(event) => {
                  tagsEditedRef.current = true
                  setTagsText(event.target.value)
                }}
                placeholder="reading, dev"
                maxLength={500}
                inputMode="text"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="quicksave-note">
                Note <span className="font-normal">(private, optional)</span>
              </FieldLabel>
              <Textarea
                id="quicksave-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Why did you save this?"
                rows={3}
                maxLength={5000}
              />
            </Field>
            <Field>
              <label
                htmlFor="quicksave-favorite"
                className="flex cursor-pointer items-center gap-2 text-sm font-medium"
              >
                <input
                  id="quicksave-favorite"
                  type="checkbox"
                  checked={isFavorite}
                  onChange={(event) => setIsFavorite(event.target.checked)}
                  className="h-4 w-4 accent-current"
                />
                Favorite
              </label>
            </Field>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Field>
              <Button
                type="submit"
                disabled={isSaving}
                className="w-full"
                size="lg"
              >
                {isSaving ? "Saving…" : "Save to HarborMarks"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
        <p className="mt-3 break-all text-xs text-muted-foreground">{url}</p>
      </CardContent>
    </Card>
  )
}
