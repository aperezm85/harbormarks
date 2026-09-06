import { Temporal } from "@js-temporal/polyfill"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ArrowCounterClockwiseIcon,
  EyeIcon,
  HeartStraightIcon,
  NotepadIcon,
  PencilSimpleIcon,
  SpinnerIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import { CreateBookmarkDialog } from "../dialog/CreateBookmarkDialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
import type { BookmarkCardData, BookmarkStatus } from "@/lib/bookmark-types"
import type { CardViewMode } from "@/lib/card-view"
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
  siteName,
  author,
  publishedAt,
  language,
  canonicalUrl,
  note,
  status = "unread",
  onSaved,
  onVisit,
  onVisitRollback,
  // onVisitReset,
  // onVisitResetRollback,
  onFavoriteToggle,
  onDeleted,
  onDeleteRollback,
  onRestored,
  onPurged,
  isTrashItem,
  viewMode = "grid",
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
  siteName: string | null
  author: string | null
  publishedAt: string | null
  language: string | null
  canonicalUrl: string | null
  note: string | null
  status?: BookmarkStatus
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
  viewMode?: CardViewMode
}) => {
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false)
  // Read status slice: cycles unread -> reading -> archived -> unread.
  const [isCyclingStatus, setIsCyclingStatus] = useState(false)
  // const [isResettingVisit, setIsResettingVisit] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPreviewImageVisible, setIsPreviewImageVisible] = useState(
    Boolean(previewImage)
  )
  const [renderedPreviewImage, setRenderedPreviewImage] = useState(previewImage)
  // Story 12 notes-only slice: controls the compact-density note dialog.
  // Opened only from the note button's click handler, never from an effect.
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false)
  // const [isSummarizerSupported, setIsSummarizerSupported] = useState(false)
  // const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false)
  // const [isSummarizing, setIsSummarizing] = useState(false)
  // const [summaryText, setSummaryText] = useState("")
  // const [summaryError, setSummaryError] = useState("")

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

    // let isMounted = true

    // void summarizerApi
    //   .availability()
    //   .then((availability) => {
    //     if (!isMounted) {
    //       return
    //     }

    //     setIsSummarizerSupported(availability !== "unavailable")
    //   })
    //   .catch(() => {
    //     if (!isMounted) {
    //       return
    //     }

    //     setIsSummarizerSupported(false)
    //   })

    return () => {
      // isMounted = false
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
    siteName,
    author,
    publishedAt,
    language,
    canonicalUrl,
    note,
    status,
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

  // const resetVisitCount = () => {
  //   if (isResettingVisit || isDeleting) {
  //     return
  //   }

  //   setIsResettingVisit(true)
  //   onVisitReset?.()

  //   void fetch(`/api/bookmarks/${id}/reset-visit`, {
  //     method: "POST",
  //     headers: {
  //       "content-type": "application/json",
  //     },
  //   })
  //     .then((response) => {
  //       if (!response.ok) {
  //         throw new Error("Unable to reset visit count")
  //       }
  //     })
  //     .catch(() => {
  //       onVisitResetRollback?.(visitCount)
  //       toast.error("Unable to reset visit count. Previous value was restored.")
  //     })
  //     .finally(() => {
  //       setIsResettingVisit(false)
  //     })
  // }

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

  const nextStatus: BookmarkStatus =
    status === "unread" ? "reading" : status === "reading" ? "archived" : "unread"

  const cycleStatus = () => {
    if (isCyclingStatus || isDeleting) {
      return
    }

    setIsCyclingStatus(true)
    onSaved?.({ ...bookmarkData, status: nextStatus })

    void fetch(`/api/bookmarks/${id}/status`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ status: nextStatus }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to update read status")
        }

        const payload = (await response.json()) as {
          data?: BookmarkCardData
        }

        if (payload.data) {
          onSaved?.(payload.data)
        }
      })
      .catch(() => {
        onSaved?.(bookmarkData)
        toast.error("Unable to update read status. Change was reverted.")
      })
      .finally(() => {
        setIsCyclingStatus(false)
      })
  }

  const statusDotClassName =
    status === "unread"
      ? "bg-sky-500"
      : status === "reading"
        ? "bg-amber-500"
        : "bg-emerald-500"

  const statusLabel =
    status === "unread" ? "Unread" : status === "reading" ? "Reading" : "Archived"

  const renderStatusControl = () => (
    <Button
      variant="ghost"
      size="icon-xs"
      className="hover:cursor-pointer"
      type="button"
      aria-label={`Mark as ${nextStatus}`}
      title={`Mark as ${nextStatus} (now ${statusLabel})`}
      disabled={isCyclingStatus || isDeleting}
      hidden={isTrashItem}
      onClick={(event) => {
        event.stopPropagation()
        cycleStatus()
      }}
    >
      {isCyclingStatus ? (
        <SpinnerIcon className="size-3 animate-spin" />
      ) : (
        <span
          aria-hidden="true"
          className={`size-2.5 rounded-full ${statusDotClassName}`}
        />
      )}
    </Button>
  )

  const renderStatusBadge = () => (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${statusDotClassName}`}
      />
      {statusLabel}
    </span>
  )

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

  // const summarizeWithAi = async () => {
  //   if (isSummarizing || isDeleting) {
  //     return
  //   }

  //   const summarizerApi = getSummarizerApi()
  //   if (!summarizerApi) {
  //     toast.error("Summarizer API is not supported in this browser.")
  //     return
  //   }

  //   setIsSummaryDialogOpen(true)
  //   setIsSummarizing(true)
  //   setSummaryText("")
  //   setSummaryError("")

  //   let summarizer: SummarizerSession | null = null

  //   try {
  //     const createPromise = summarizerApi.create({
  //       type: "tldr",
  //       format: "plain-text",
  //       length: "medium",
  //     })

  //     const availability = await summarizerApi.availability()
  //     if (availability === "unavailable") {
  //       throw new Error("Summarizer API is unavailable on this device.")
  //     }

  //     if (availability === "downloadable" || availability === "downloading") {
  //       toast.message("Preparing AI model", {
  //         description:
  //           "Chrome may download the on-device model before summarizing.",
  //       })
  //     }

  //     const sourceResponse = await fetch(
  //       `/api/bookmarks/summarize-source?url=${encodeURIComponent(url)}`,
  //       {
  //         headers: {
  //           accept: "application/json",
  //         },
  //       }
  //     )

  //     const sourcePayload = (await sourceResponse.json()) as {
  //       data?: {
  //         content: string
  //       }
  //       error?: string
  //     }

  //     if (!sourceResponse.ok) {
  //       throw new Error(sourcePayload.error ?? "Unable to read page content.")
  //     }

  //     const sourceText = sourcePayload.data?.content?.trim()
  //     if (!sourceText) {
  //       throw new Error("No readable content found on this page.")
  //     }

  //     summarizer = await createPromise

  //     const summary = await summarizer.summarize(sourceText, {
  //       context:
  //         "Provide a concise summary in simple language with the key takeaway first.",
  //     })

  //     setSummaryText(summary.trim())
  //   } catch (error) {
  //     const rawMessage = error instanceof Error ? error.message : ""
  //     const normalizedMessage = rawMessage.toLowerCase()

  //     const message =
  //       normalizedMessage.includes("cancel") ||
  //       normalizedMessage.includes("aborted")
  //         ? "The AI summary request was cancelled. Please try again."
  //         : rawMessage || "Unable to summarize this page right now."

  //     setSummaryError(message)
  //     toast.error(message)
  //   } finally {
  //     summarizer?.destroy?.()
  //     setIsSummarizing(false)
  //   }
  // }

  const rtf = new Intl.RelativeTimeFormat("en", {
    numeric: "auto",
  })
  const now = Temporal.Now.instant()

  const created = Temporal.Instant.from(createdAt)

  const days = Math.floor(created.until(now).total({ unit: "day" }))
  const createdRelativeTime = rtf.format(-days, "day")

  // Shared action cluster for the list and compact densities. Same handlers
  // and dialogs as the grid card, only the layout wrapper differs.
  const renderStandaloneActions = () => (
    <div className="relative z-20 flex shrink-0 items-center gap-1">
      {renderStatusControl()}
      <Button
        variant="ghost"
        size="icon-xs"
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
          <SpinnerIcon className="size-3 animate-spin" />
        ) : isFavorite ? (
          <HeartStraightIcon weight="fill" className="size-3 text-red-500" />
        ) : (
          <HeartStraightIcon className="size-3 text-muted-foreground" />
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
          siteName,
          author,
          publishedAt,
          language,
          canonicalUrl,
          note,
          status,
        }}
        onSaved={onSaved}
        trigger={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Edit bookmark"
            title="Edit bookmark"
            disabled={isDeleting}
            hidden={isTrashItem}
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <PencilSimpleIcon size="3" />
          </Button>
        }
      />

      {isTrashItem ? (
        <>
          <Button
            variant="ghost"
            size="icon-xs"
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
              <SpinnerIcon className="size-3 animate-spin" />
            ) : (
              <ArrowCounterClockwiseIcon size="3" />
            )}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="icon-xs"
                type="button"
                aria-label="Delete bookmark permanently"
                title="Delete permanently"
                disabled={isDeleting}
                onClick={(event) => {
                  event.stopPropagation()
                }}
              >
                <TrashIcon size="3" weight="light" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
                  <TrashIcon weight="light" />
                </AlertDialogMedia>
                <AlertDialogTitle>
                  Delete this bookmark permanently?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This removes &ldquo;{title}&rdquo; from your harbor for good.
                  It cannot be restored, and there is no undo.
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
                      <SpinnerIcon className="size-3 animate-spin" />
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
              variant="ghost"
              size="icon-xs"
              type="button"
              aria-label="Delete bookmark"
              title="Delete bookmark"
              className="group/trash"
              disabled={isDeleting}
              onClick={(event) => {
                event.stopPropagation()
              }}
            >
              <TrashIcon
                size="3"
                weight="light"
                className="group-hover/trash:text-destructive hover:text-destructive"
              />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
                <TrashIcon weight="light" />
              </AlertDialogMedia>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will move your bookmark to Trash. You can undo it from the
                toast after deletion.
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
                    <SpinnerIcon className="size-3 animate-spin" />
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
  )

  const stretchedLink = (
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
  )

  // CardListView: cards stacked vertically, simplified horizontal card with a
  // small fixed thumbnail (like the proto's list density). Always rendered —
  // never the compact image-less row.
  if (viewMode === "list") {
    return (
      <div className="group relative flex flex-row items-stretch overflow-hidden rounded-md bg-card text-sm text-card-foreground ring-1 ring-foreground/10 transition-colors hover:bg-muted/50">
        {stretchedLink}
        <div className="relative z-0 w-[120px] shrink-0 self-stretch sm:w-[152px]">
          {previewImage && isPreviewImageVisible ? (
            <img
              src={previewImage}
              alt={`${title} preview`}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
              onError={() => setIsPreviewImageVisible(false)}
            />
          ) : (
            <div className="absolute inset-0 bg-linear-to-br from-sky-500/25 via-cyan-400/15 to-indigo-500/30" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <img
              src={favicon}
              alt={`${title} favicon`}
              className="size-3 shrink-0 rounded-sm bg-accent p-px"
            />
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
              {siteName ?? url}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
              {createdRelativeTime}
            </span>
          </div>
          <div className="truncate text-sm leading-snug font-medium">
            {title}
          </div>
          <p className="line-clamp-2 text-[12px] text-muted-foreground">
            {description}
          </p>
          {isTrashItem ? null : (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {renderStatusBadge()}
            </div>
          )}
          {note?.trim() ? (
            <p className="m-0 mt-2 flex items-start gap-1.75 rounded-sm border-l-2 border-l-primary bg-muted px-2 py-2.5 text-[12.5px]/[1.45] font-light text-foreground">
              <NotepadIcon className="w-7 text-primary" />
              {note}
            </p>
          ) : null}
          {tags.length > 0 ? (
            <div className="mt-auto flex flex-wrap gap-1.5 pt-1.5">
              {tags.map((tag) => (
                <Badge variant="outline" key={tag}>
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        <div className="relative z-20 flex shrink-0 flex-col items-end justify-between gap-2 border-l bg-muted/20 px-3 py-3">
          <div className="flex items-center gap-0.75 text-muted-foreground">
            <EyeIcon className="size-3" />
            <span className="font-mono text-[10px]/[12px]">{visitCount}</span>
          </div>
          {renderStandaloneActions()}
        </div>
      </div>
    )
  }

  // CompactView: a dense single-row list. No preview image is rendered at
  // all — not even hidden — so compact mode issues no image requests.
  if (viewMode === "compact") {
    return (
      <div className="group relative flex h-11 min-w-0 flex-row items-center gap-2 bg-card px-3 text-sm text-card-foreground ring-1 ring-foreground/10 transition-colors hover:bg-muted/50">
        {stretchedLink}
        <img
          src={favicon}
          alt={`${title} favicon`}
          className="relative z-0 size-3.5 shrink-0 rounded-sm bg-accent p-px"
        />
        <span className="relative z-0 min-w-0 flex-1 truncate leading-snug font-medium">
          {title}
        </span>
        <span className="relative z-0 hidden w-36 shrink-0 truncate font-mono text-[11px] text-muted-foreground lg:block">
          {siteName ?? url}
        </span>
        {tags.length > 0 ? (
          <span className="relative z-0 hidden shrink-0 items-center gap-1 md:flex">
            {tags.slice(0, 2).map((tag) => (
              <Badge variant="outline" key={tag}>
                {tag}
              </Badge>
            ))}
          </span>
        ) : null}
        <span className="relative z-0 flex shrink-0 items-center gap-0.75 text-muted-foreground">
          <EyeIcon className="size-3" />
          <span className="font-mono text-[10px]/[12px]">{visitCount}</span>
        </span>
        {note?.trim() ? (
          <>
            <Button
              variant="ghost"
              size="icon-xs"
              type="button"
              aria-label="View note"
              title="View note"
              className="relative z-20"
              onClick={(event) => {
                event.stopPropagation()
                setIsNoteDialogOpen(true)
              }}
            >
              <NotepadIcon className="size-3 text-primary" />
            </Button>
            <Dialog
              open={isNoteDialogOpen}
              onOpenChange={setIsNoteDialogOpen}
            >
              <DialogContent
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <DialogHeader>
                  <DialogTitle>Your note</DialogTitle>
                  <DialogDescription>{title}</DialogDescription>
                </DialogHeader>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {note}
                </p>
              </DialogContent>
            </Dialog>
          </>
        ) : null}
        {renderStandaloneActions()}
      </div>
    )
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
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            onError={() => setIsPreviewImageVisible(false)}
          />
        ) : (
          <div className="h-full w-full bg-linear-to-br from-sky-500/25 via-cyan-400/15 to-indigo-500/30" />
        )}
      </div>
      <CardHeader className="min-w-0">
        <div className="flex w-full min-w-0 items-center justify-start gap-2">
          <img
            src={favicon}
            alt={`${title} favicon`}
            className="size-3 rounded-sm bg-accent p-px"
          />
          <span className="truncate overflow-hidden font-mono text-[11px] text-muted-foreground">
            {url}
          </span>
          <span></span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {createdRelativeTime}
          </span>
        </div>
        <CardTitle className="min-w-0 wrap-break-word">{title}</CardTitle>
      </CardHeader>
      <CardContent className="mt-auto flex flex-1 flex-col justify-between">
        <p className="text-[12px] text-muted-foreground">{description}</p>
        <div>
          {/* <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
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
                  <SpinnerIcon className="size-3 animate-spin" />
                ) : (
                  <ArrowsCounterClockwiseIcon className="size-3" />
                )}
                {isResettingVisit ? "Resetting..." : "Reset"}
              </Button>
            )}
          </div> */}
          {/* {!isTrashItem && isSummarizerSupported && (
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
                    <SpinnerIcon className="size-3 animate-spin" />
                    Summarizing...
                  </>
                ) : (
                  "Summarize with AI"
                )}
                <SparkleIcon
                  className="size-3 text-yellow-500"
                  data-icon="inline-end"
                />
              </Button>
            </div>
          )} */}
          {/* Story 12 notes-only slice: private user note. */}
          {note?.trim() ? (
            <p className="m-0 mt-2 flex items-start gap-1.75 rounded-sm border-l-2 border-l-primary bg-muted px-2 py-2.5 text-[12.5px]/[1.45] font-light text-foreground">
              <NotepadIcon className="w-7 text-primary" />
              {note}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge variant="outline" key={tag}>
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex flex-1 items-center justify-start gap-2 text-muted-foreground">
          <div className="flex items-center gap-0.75">
            <EyeIcon className="size-3" />
            <span className="font-mono text-[10px]/[12px]">{visitCount}</span>
          </div>
          {isTrashItem ? null : renderStatusBadge()}
        </div>
        <div className="relative z-20 flex shrink-0 items-center gap-2">
          {isTrashItem ? null : renderStatusControl()}
          <Button
            variant="ghost"
            size="icon-xs"
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
              <SpinnerIcon className="size-3 animate-spin" />
            ) : isFavorite ? (
              <span className="relative inline-flex size-3 items-center justify-center">
                <HeartStraightIcon
                  weight="fill"
                  className="absolute size-3 text-red-500 transition-opacity group-hover/heart:opacity-0"
                />
                <HeartStraightIcon className="absolute size-3 text-white opacity-0 transition-opacity group-hover/heart:opacity-100" />
              </span>
            ) : (
              <span className="relative inline-flex size-3 items-center justify-center">
                <HeartStraightIcon className="absolute size-3 text-muted-foreground transition-opacity group-hover/heart:opacity-0" />
                <HeartStraightIcon
                  weight="fill"
                  className="absolute size-3 text-red-500 opacity-0 transition-opacity group-hover/heart:opacity-100"
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
              siteName,
              author,
              publishedAt,
              language,
              canonicalUrl,
              note,
              status,
            }}
            onSaved={onSaved}
            trigger={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Edit bookmark"
                title="Edit bookmark"
                disabled={isDeleting}
                hidden={isTrashItem}
                onClick={(event) => {
                  event.stopPropagation()
                }}
              >
                <PencilSimpleIcon size="3" />
              </Button>
            }
          />

          {isTrashItem ? (
            <>
              <Button
                variant="ghost"
                size="icon-xs"
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
                  <SpinnerIcon className="size-3 animate-spin" />
                ) : (
                  <ArrowCounterClockwiseIcon size="3" />
                )}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon-xs"
                    type="button"
                    aria-label="Delete bookmark permanently"
                    title="Delete permanently"
                    disabled={isDeleting}
                    onClick={(event) => {
                      event.stopPropagation()
                    }}
                  >
                    <TrashIcon size="3" weight="light" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <AlertDialogHeader>
                    <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
                      <TrashIcon weight="light" />
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
                          <SpinnerIcon className="size-3 animate-spin" />
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
                  variant="ghost"
                  size="icon-xs"
                  type="button"
                  aria-label="Delete bookmark"
                  title="Delete bookmark"
                  className="group/trash"
                  disabled={isDeleting}
                  onClick={(event) => {
                    event.stopPropagation()
                  }}
                >
                  <TrashIcon
                    size="3"
                    weight="light"
                    className="group-hover/trash:text-destructive hover:text-destructive"
                  />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <AlertDialogHeader>
                  <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
                    <TrashIcon weight="light" />
                  </AlertDialogMedia>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will move your bookmark to Trash. You can undo it from
                    the toast after deletion.
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
                        <SpinnerIcon className="size-3 animate-spin" />
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
      </CardFooter>
      {/* <Dialog
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
      </Dialog> */}
    </Card>
  )
}
