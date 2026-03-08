import { useEffect } from "react"
import { toast } from "sonner"

interface Props {
  error?: string | null
}

export default function ErrorToast({ error }: Props) {
  useEffect(() => {
    if (error) {
      toast.error(error, {
        position: "top-center",
        style: {
          color: "var(--destructive)",
        },
      })
    }
  }, [error])

  return null
}
