import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ArrowCounterClockwiseIcon,
  ArrowsCounterClockwiseIcon,
  HeartStraightIcon,
  PencilSimpleIcon,
  SparkleIcon,
  SpinnerIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import { CreateBookmarkDialog } from "../dialog/CreateBookmarkDialog"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { BookmarkCardData } from "@/lib/bookmark-types"
import { useEffect, useState } from "react"
import { toast } from "sonner"

type SummarizerAvailability =
  "available" | "downloadable" | "downloading" | "unavailable"

type SummarizerSession = {
  summarize: (
    input: string,
    options?: {
      context?: string
    }
  ) => Promise<string>
  destroy?: () => void
}

type SummarizerApi = {
  availability: () => Promise<SummarizerAvailability>
  create: (options?: {
    type?: "key-points" | "tldr" | "teaser" | "headline"
    format?: "markdown" | "plain-text"
    length?: "short" | "medium" | "long"
  }) => Promise<SummarizerSession>
}

function getSummarizerApi() {
  if (typeof window === "undefined" || !("Summarizer" in window)) {
    return null
  }

  return (
    window as Window & {
      Summarizer?: SummarizerApi
    }
  ).Summarizer
}

export const HarborCard = ({
  id,
  url,
  title,
  description,
  favicon,
  previewImage,
  tags,
  createdAt,
  updatedAt,
  lastVisitedAt,
  isFavorite,
  visitCount,
  onSaved,
  onVisit,
  onVisitRollback,
  onVisitReset,
  onVisitResetRollback,
  onFavoriteToggle,
  onDeleted,
  onDeleteRollback,
  onRestored,
  onPurged,
  isTrashItem,
}: {
  id: string
  url: string
  title: string
  description: string
  favicon: string
  previewImage: string | null
  tags: string[]
  createdAt: string
  updatedAt: string | null
  lastVisitedAt: string | null
  isFavorite: boolean
  visitCount: number
  onSaved?: (bookmark: BookmarkCardData) => void
  onVisit?: () => void
  onVisitRollback?: () => void
  onVisitReset?: () => void
  onVisitResetRollback?: (previousCount: number) => void
  onFavoriteToggle?: (nextIsFavorite: boolean) => void
  onDeleted?: (bookmark: BookmarkCardData) => void
  onDeleteRollback?: (bookmark: BookmarkCardData) => void
  onRestored?: (bookmark: BookmarkCardData) => void
  onPurged?: (bookmark: BookmarkCardData) => void
  isTrashItem?: boolean
}) => {
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false)
  const [isResettingVisit, setIsResettingVisit] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPreviewImageVisible, setIsPreviewImageVisible] = useState(
    Boolean(previewImage)
  )
  const [renderedPreviewImage, setRenderedPreviewImage] = useState(previewImage)
  const [isSummarizerSupported, setIsSummarizerSupported] = useState(false)
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [summaryText, setSummaryText] = useState("")
  const [summaryError, setSummaryError] = useState("")

  // A new previewImage means any earlier load failure no longer applies, so the
  // image is shown again. Adjusting state during render is React's documented
  // pattern for this; an effect would render the stale state first.
  if (renderedPreviewImage !== previewImage) {
    setRenderedPreviewImage(previewImage)
    setIsPreviewImageVisible(Boolean(previewImage))
  }

  useEffect(() => {
    const summarizerApi = getSummarizerApi()

    if (!summarizerApi) {
      return
    }

    let isMounted = true

    void summarizerApi
      .availability()
      .then((availability) => {
        if (!isMounted) {
          return
        }

        setIsSummarizerSupported(availability !== "unavailable")
      })
      .catch(() => {
        if (!isMounted) {
          return
        }

        setIsSummarizerSupported(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const bookmarkData: BookmarkCardData = {
    id,
    url,
    title,
    description,
    favicon,
    previewImage,
    tags,
    createdAt,
    updatedAt,
    lastVisitedAt,
    isFavorite,
    visitCount,
  }

  const openBookmark = () => {
    onVisit?.()

    void fetch(`/api/bookmarks/${id}/visit`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      keepalive: true,
    }).catch(() => {
      onVisitRollback?.()
      toast.error("Unable to track bookmark visit. Counter was restored.")
    })
  }

  const resetVisitCount = () => {
    if (isResettingVisit || isDeleting) {
      return
    }

    setIsResettingVisit(true)
    onVisitReset?.()

    void fetch(`/api/bookmarks/${id}/reset-visit`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to reset visit count")
        }
      })
      .catch(() => {
        onVisitResetRollback?.(visitCount)
        toast.error("Unable to reset visit count. Previous value was restored.")
      })
      .finally(() => {
        setIsResettingVisit(false)
      })
  }

  const toggleFavorite = () => {
    if (isTogglingFavorite || isDeleting) {
      return
    }

    setIsTogglingFavorite(true)
    onFavoriteToggle?.(!isFavorite)

    void fetch(`/api/bookmarks/${id}/toggle-favorite`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to toggle favorite")
        }
      })
      .catch(() => {
        onFavoriteToggle?.(isFavorite)
        toast.error("Unable to update favorite status. Change was reverted.")
      })
      .finally(() => {
        setIsTogglingFavorite(false)
      })
  }

  const deleteBookmark = () => {
    if (isDeleting) {
      return
    }

    setIsDeleting(true)
    onDeleted?.(bookmarkData)

    void fetch(`/api/bookmarks/${id}/delete`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to delete bookmark")
        }

        toast.success("Bookmark moved to Trash.", {
          action: {
            label: "Undo",
            onClick: () => {
              void fetch(`/api/bookmarks/${id}/restore`, {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                },
              })
                .then((restoreResponse) => {
                  if (!restoreResponse.ok) {
                    throw new Error("Unable to restore bookmark")
                  }

                  onDeleteRollback?.(bookmarkData)
                  toast.success("Bookmark restored.")
                })
                .catch(() => {
                  toast.error("Unable to restore bookmark.")
                })
            },
          },
        })
      })
      .catch(() => {
        onDeleteRollback?.(bookmarkData)
        toast.error("Unable to move bookmark to Trash. Card was restored.")
      })
      .finally(() => {
        setIsDeleting(false)
      })
  }

  const restoreBookmark = () => {
    if (isDeleting) {
      return
    }

    setIsDeleting(true)

    void fetch(`/api/bookmarks/${id}/restore`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to restore bookmark")
        }

        onRestored?.(bookmarkData)
        toast.success("Bookmark restored from Trash.")
      })
      .catch(() => {
        toast.error("Unable to restore bookmark.")
      })
      .finally(() => {
        setIsDeleting(false)
      })
  }

  const purgeBookmark = () => {
    if (isDeleting) {
      return
    }

    setIsDeleting(true)

    void fetch(`/api/bookmarks/${id}/purge`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to delete bookmark permanently")
        }

        onPurged?.(bookmarkData)
        toast.success("Bookmark permanently deleted.")
      })
      .catch(() => {
        toast.error("Unable to delete bookmark permanently.")
      })
      .finally(() => {
        setIsDeleting(false)
      })
  }

  const summarizeWithAi = async () => {
    if (isSummarizing || isDeleting) {
      return
    }

    const summarizerApi = getSummarizerApi()
    if (!summarizerApi) {
      toast.error("Summarizer API is not supported in this browser.")
      return
    }

    setIsSummaryDialogOpen(true)
    setIsSummarizing(true)
    setSummaryText("")
    setSummaryError("")

    let summarizer: SummarizerSession | null = null

    try {
      const createPromise = summarizerApi.create({
        type: "tldr",
        format: "plain-text",
        length: "medium",
      })

      const availability = await summarizerApi.availability()
      if (availability === "unavailable") {
        throw new Error("Summarizer API is unavailable on this device.")
      }

      if (availability === "downloadable" || availability === "downloading") {
        toast.message("Preparing AI model", {
          description:
            "Chrome may download the on-device model before summarizing.",
        })
      }

      const sourceResponse = await fetch(
        `/api/bookmarks/summarize-source?url=${encodeURIComponent(url)}`,
        {
          headers: {
            accept: "application/json",
          },
        }
      )

      const sourcePayload = (await sourceResponse.json()) as {
        data?: {
          content: string
        }
        error?: string
      }

      if (!sourceResponse.ok) {
        throw new Error(sourcePayload.error ?? "Unable to read page content.")
      }

      const sourceText = sourcePayload.data?.content?.trim()
      if (!sourceText) {
        throw new Error("No readable content found on this page.")
      }

      summarizer = await createPromise

      const summary = await summarizer.summarize(sourceText, {
        context:
          "Provide a concise summary in simple language with the key takeaway first.",
      })

      setSummaryText(summary.trim())
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : ""
      const normalizedMessage = rawMessage.toLowerCase()

      const message =
        normalizedMessage.includes("cancel") ||
        normalizedMessage.includes("aborted")
          ? "The AI summary request was cancelled. Please try again."
          : rawMessage || "Unable to summarize this page right now."

      setSummaryError(message)
      toast.error(message)
    } finally {
      summarizer?.destroy?.()
      setIsSummarizing(false)
    }
  }

  return (
    <Card className="group relative h-full border pt-0 transition-colors hover:bg-muted/50">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open bookmark: ${title}`}
        className="absolute inset-0 z-10 rounded-[inherit] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        onClick={() => {
          openBookmark()
        }}
      >
        <span className="sr-only">Open bookmark: {title}</span>
      </a>
      <div className="relative z-0 aspect-video w-full overflow-hidden">
        {previewImage && isPreviewImageVisible ? (
          <img
            src={previewImage}
            alt={`${title} preview`}
            className="h-full w-full object-cover brightness-60 grayscale dark:brightness-40"
            loading="lazy"
            decoding="async"
            onError={() => setIsPreviewImageVisible(false)}
          />
        ) : (
          <div className="h-full w-full bg-linear-to-br from-sky-500/25 via-cyan-400/15 to-indigo-500/30" />
        )}
      </div>
      <CardHeader className="min-w-0">
        <div className="flex w-full min-w-0 items-center justify-between gap-2">
          <img
            src={favicon}
            alt={`${title} favicon`}
            className="size-8 rounded-md bg-accent p-1"
          />
          <div className="relative z-20 flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="group/heart hover:cursor-pointer"
              type="button"
              aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
              disabled={isTogglingFavorite || isDeleting}
              hidden={isTrashItem}
              onClick={(event) => {
                event.stopPropagation()
                toggleFavorite()
              }}
            >
              {isTogglingFavorite ? (
                <SpinnerIcon className="size-4 animate-spin" />
              ) : isFavorite ? (
                <span className="relative inline-flex size-4 items-center justify-center">
                  <HeartStraightIcon
                    weight="fill"
                    className="absolute size-4 text-red-500 transition-opacity group-hover/heart:opacity-0"
                  />
                  <HeartStraightIcon className="absolute size-4 text-white opacity-0 transition-opacity group-hover/heart:opacity-100" />
                </span>
              ) : (
                <span className="relative inline-flex size-4 items-center justify-center">
                  <HeartStraightIcon className="absolute size-4 text-muted-foreground transition-opacity group-hover/heart:opacity-0" />
                  <HeartStraightIcon
                    weight="fill"
                    className="absolute size-4 text-red-500 opacity-0 transition-opacity group-hover/heart:opacity-100"
                  />
                </span>
              )}
            </Button>

            <CreateBookmarkDialog
              bookmark={{
                id,
                url,
                title,
                description,
                favicon,
                previewImage,
                tags,
              }}
              onSaved={onSaved}
              trigger={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Edit bookmark"
                  title="Edit bookmark"
                  disabled={isDeleting}
                  hidden={isTrashItem}
                  onClick={(event) => {
                    event.stopPropagation()
                  }}
                >
                  <PencilSimpleIcon />
                </Button>
              }
            />

            {isTrashItem ? (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  aria-label="Restore bookmark"
                  title="Restore bookmark"
                  disabled={isDeleting}
                  onClick={(event) => {
                    event.stopPropagation()
                    restoreBookmark()
                  }}
                >
                  {isDeleting ? (
                    <SpinnerIcon className="size-4 animate-spin" />
                  ) : (
                    <ArrowCounterClockwiseIcon />
                  )}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="icon"
                      type="button"
                      aria-label="Delete bookmark permanently"
                      title="Delete permanently"
                      disabled={isDeleting}
                      onClick={(event) => {
                        event.stopPropagation()
                      }}
                    >
                      <TrashIcon weight="fill" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <AlertDialogHeader>
                      <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
                        <TrashIcon weight="fill" />
                      </AlertDialogMedia>
                      <AlertDialogTitle>
                        Delete this bookmark permanently?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes &ldquo;{title}&rdquo; from your harbor for
                        good. It cannot be restored, and there is no undo.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel
                        variant="outline"
                        disabled={isDeleting}
                        onClick={(event) => event.stopPropagation()}
                      >
                        Keep in Trash
                      </AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        disabled={isDeleting}
                        onClick={(event) => {
                          event.stopPropagation()
                          purgeBookmark()
                        }}
                      >
                        {isDeleting ? (
                          <>
                            <SpinnerIcon className="size-4 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          "Delete permanently"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon"
                    type="button"
                    aria-label="Delete bookmark"
                    title="Delete bookmark"
                    disabled={isDeleting}
                    onClick={(event) => {
                      event.stopPropagation()
                    }}
                  >
                    <TrashIcon weight="fill" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <AlertDialogHeader>
                    <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
                      <TrashIcon weight="fill" />
                    </AlertDialogMedia>
                    <AlertDialogTitle>
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will move your bookmark to Trash. You can undo it
                      from the toast after deletion.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel
                      variant="outline"
                      disabled={isDeleting}
                      onClick={(event) => event.stopPropagation()}
                    >
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      disabled={isDeleting}
                      onClick={(event) => {
                        event.stopPropagation()
                        deleteBookmark()
                      }}
                    >
                      {isDeleting ? (
                        <>
                          <SpinnerIcon className="size-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        "Delete"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
        <CardTitle className="min-w-0 wrap-break-word">{title}</CardTitle>
        <CardDescription className="min-w-0 break-all">{url}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto flex flex-1 flex-col justify-between">
        <p>{description}</p>
        <div>
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              Opened <strong>{visitCount}</strong>{" "}
              {visitCount === 1 ? "time" : "times"}
            </span>
            {!isTrashItem && (
              <Button
                variant="outline"
                size="sm"
                type="button"
                aria-label="Reset visit count"
                disabled={isResettingVisit || isDeleting}
                onClick={(event) => {
                  event.stopPropagation()
                  resetVisitCount()
                }}
              >
                {isResettingVisit ? (
                  <SpinnerIcon className="size-4 animate-spin" />
                ) : (
                  <ArrowsCounterClockwiseIcon className="size-4" />
                )}
                {isResettingVisit ? "Resetting..." : "Reset"}
              </Button>
            )}
          </div>
          {!isTrashItem && isSummarizerSupported && (
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={isSummarizing || isDeleting}
                onClick={(event) => {
                  event.stopPropagation()
                  void summarizeWithAi()
                }}
                className="flex items-center justify-center gap-2 align-middle"
                aria-label="Summarize bookmark with AI"
              >
                {isSummarizing ? (
                  <>
                    <SpinnerIcon className="size-4 animate-spin" />
                    Summarizing...
                  </>
                ) : (
                  "Summarize with AI"
                )}
                <SparkleIcon
                  className="size-4 text-yellow-500"
                  data-icon="inline-end"
                />
              </Button>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge variant="default" key={tag}>
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
      <Dialog
        open={isSummaryDialogOpen}
        onOpenChange={(nextOpen) => {
          setIsSummaryDialogOpen(nextOpen)

          if (!nextOpen && !isSummarizing) {
            setSummaryText("")
            setSummaryError("")
          }
        }}
      >
        <DialogContent
          className="max-h-[85vh] overflow-y-auto sm:max-w-lg"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>AI Summary</DialogTitle>
            <DialogDescription>{title}</DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed whitespace-pre-wrap">
            {isSummarizing &&
              "Preparing summary... this can take a few seconds."}
            {!isSummarizing && summaryError && summaryError}
            {!isSummarizing && !summaryError && summaryText}
          </div>

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </Card>
  )
}
