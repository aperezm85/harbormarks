import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HeartStraightIcon, TrashIcon } from "@phosphor-icons/react"

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

export const HarborCard = ({
  id,
  url,
  title,
  description,
  favicon,
  tags,
  isFavorite,
}: {
  id: string
  url: string
  title: string
  description: string
  favicon: string
  tags: string[]
  createdAt: string
  isFavorite: boolean
}) => {
  const openBookmark = () => {
    void fetch(`/api/bookmarks/${id}/visit`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      keepalive: true,
    }).catch(() => {
      // Ignore tracking failures so opening links always works.
    })

    window.open(url, "_blank", "noopener,noreferrer")
  }

  return (
    <Card
      className="group h-full cursor-pointer border transition-colors hover:bg-muted/50"
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
            <form method="POST" action={`/api/bookmarks/${id}/toggle-favorite`}>
              <Button
                variant="ghost"
                size="icon"
                className="group/heart hover:cursor-pointer"
                type="submit"
              >
                {isFavorite ? (
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
            </form>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon">
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
                  <AlertDialogCancel variant="outline">
                    Cancel
                  </AlertDialogCancel>
                  <form method="POST" action={`/api/bookmarks/${id}/delete`}>
                    <AlertDialogAction variant="destructive" type="submit">
                      Delete
                    </AlertDialogAction>
                  </form>
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
