import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type AdminUserAvatarProps = {
  name: string
  email: string
  avatarUrl: string
  className?: string
}

export function AdminUserAvatar({
  name,
  email,
  avatarUrl,
  className,
}: AdminUserAvatarProps) {
  return (
    <Avatar className={className ?? "h-10 w-10 rounded-lg"}>
      <AvatarImage src={avatarUrl} alt={name || email} />
      <AvatarFallback className="rounded-lg">
        {(name || email).slice(0, 1).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}
