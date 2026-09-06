import { useEffect, useRef } from "react"
import { toast } from "sonner"

interface Props {
  status?: string | null
  error?: string | null
}

function isProfilePath() {
  return window.location.pathname.startsWith("/profile")
}

function stripStatusParams() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has("status") && !url.searchParams.has("error")) {
    return
  }
  url.searchParams.delete("status")
  url.searchParams.delete("error")
  const stripped = `${url.pathname}${url.search}${url.hash}`
  window.history.replaceState(null, "", stripped)
}

export default function ProfileToast({ status, error }: Props) {
  const consumedRef = useRef(false)

  useEffect(() => {
    // Profile-scoped: this island only mounts on /profile, but guard anyway
    // so a persisted island (Astro ClientRouter) can never fire on home.
    if (consumedRef.current || !isProfilePath()) {
      return
    }
    if (status === "updated") {
      consumedRef.current = true
      toast.success("Profile updated.", {
        position: "top-center",
      })
    } else if (error) {
      consumedRef.current = true
      toast.error(error, {
        position: "top-center",
        style: {
          color: "var(--destructive)",
        },
      })
    }
    // Strip ?status=/?error= after consuming so back/forward navigation or
    // client-side routing to "/" can never re-fire this toast.
    if (consumedRef.current) {
      stripStatusParams()
    }
  }, [status, error])

  // Avatar saves are fetch-based (no page reload), so the inline script on
  // profile.astro dispatches these events instead of importing sonner
  // directly (bare imports are not bundled in inline Astro scripts).
  useEffect(() => {
    const onProfileToast = (event: Event) => {
      // Keep fetch-based avatar toasts profile-scoped too.
      if (!isProfilePath()) {
        return
      }
      const detail = (event as CustomEvent<{ type?: string; message?: string }>)
        .detail
      if (!detail?.message) {
        return
      }
      if (detail.type === "error") {
        toast.error(detail.message, {
          position: "top-center",
          style: {
            color: "var(--destructive)",
          },
        })
      } else {
        toast.success(detail.message, {
          position: "top-center",
        })
      }
    }

    window.addEventListener("profile:toast", onProfileToast)
    return () => {
      window.removeEventListener("profile:toast", onProfileToast)
    }
  }, [])

  return null
}
