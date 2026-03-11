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
  ArrowsCounterClockwiseIcon,
  HeartStraightIcon,
  PencilSimpleIcon,
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
import type { BookmarkCardData } from "@/lib/bookmarks"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export const HarborCard = ({
  id,
  url,
  title,
  description,
  favicon,
  previewImage,
  tags,
  createdAt,
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
}: {
  id: string
  url: string
  title: string
  description: string
  favicon: string
  previewImage: string | null
  tags: string[]
  createdAt: string
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
}) => {
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false)
  const [isResettingVisit, setIsResettingVisit] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPreviewImageVisible, setIsPreviewImageVisible] = useState(
    Boolean(previewImage)
  )

  useEffect(() => {
    setIsPreviewImageVisible(Boolean(previewImage))
  }, [previewImage])

  const bookmarkData: BookmarkCardData = {
    id,
    url,
    title,
    description,
    favicon,
    previewImage,
    tags,
    createdAt,
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

    window.open(url, "_blank", "noopener,noreferrer")
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
      })
      .catch(() => {
        onDeleteRollback?.(bookmarkData)
        toast.error("Unable to delete bookmark. Card was restored.")
      })
      .finally(() => {
        setIsDeleting(false)
      })
  }

  return (
    <Card
      className="group h-full cursor-pointer border pt-0 transition-colors hover:bg-muted/50"
      role="link"
      tabIndex={0}
      onClick={openBookmark}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          openBookmark()
        }
      }}
    >
      <div className="relative z-20 aspect-video w-full overflow-hidden">
        {previewImage && isPreviewImageVisible ? (
          <img
            src={previewImage}
            alt={`${title} preview`}
            className="h-full w-full object-cover brightness-60 grayscale dark:brightness-40"
            onError={() => setIsPreviewImageVisible(false)}
          />
        ) : (
          <div className="h-full w-full bg-linear-to-br from-sky-500/25 via-cyan-400/15 to-indigo-500/30" />
        )}
      </div>
      <CardHeader>
        <div className="flex w-full items-center justify-between">
          <img
            src={favicon}
            alt={`${title} favicon`}
            className="size-8 rounded-md bg-accent p-1"
          />
          <div
            className="flex items-center gap-2"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="group/heart hover:cursor-pointer"
              type="button"
              disabled={isTogglingFavorite || isDeleting}
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
                  disabled={isDeleting}
                >
                  <PencilSimpleIcon />
                </Button>
              }
            />

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon" disabled={isDeleting}>
                  <TrashIcon weight="fill" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
                    <TrashIcon weight="fill" />
                  </AlertDialogMedia>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete
                    your bookmark from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel variant="outline" disabled={isDeleting}>
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
          </div>
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{url}</CardDescription>
      </CardHeader>
      <CardContent>
        <p>{description}</p>
        <div
          className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <span>
            Opened <strong>{visitCount}</strong>{" "}
            {visitCount === 1 ? "time" : "times"}
          </span>
          <Button
            variant="outline"
            size="sm"
            type="button"
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
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge variant="default" key={tag}>
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
