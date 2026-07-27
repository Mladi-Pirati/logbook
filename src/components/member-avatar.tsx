"use client"

import { decode } from "blurhash"
import { useMemo, useState } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

const cache = new Map<string, string>()

function getPlaceholder(blurhash: string) {
  const cached = cache.get(blurhash)
  if (cached) return cached
  if (typeof document === "undefined") return ""
  const size = 24
  const pixels = decode(blurhash, size, size)
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext("2d")
  if (!context) return ""
  context.putImageData(
    new ImageData(new Uint8ClampedArray(Array.from(pixels)), size, size),
    0,
    0,
  )
  const result = canvas.toDataURL()
  cache.set(blurhash, result)
  return result
}

export type AvatarMember = {
  id: string
  firstName: string
  lastName: string
  profilePictureBlurhash: string | null
  profilePictureVersion: string | null
}

export function MemberAvatar({
  className,
  member,
}: {
  className?: string
  member: AvatarMember
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const placeholder = useMemo(
    () =>
      member.profilePictureBlurhash
        ? getPlaceholder(member.profilePictureBlurhash)
        : "",
    [member.profilePictureBlurhash],
  )
  const pictureUrl = member.profilePictureVersion
    ? `/api/profile-pictures/${encodeURIComponent(member.id)}/${encodeURIComponent(member.profilePictureVersion)}`
    : null
  const src = failedUrl === pictureUrl ? null : pictureUrl
  const initials =
    `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`.toUpperCase() ||
    "?"

  return (
    <Avatar className={cn(className)}>
      {src ? (
        <AvatarImage
          alt=""
          onError={() => setFailedUrl(src)}
          src={src}
          style={
            placeholder
              ? { backgroundImage: `url(${placeholder})`, backgroundSize: "cover" }
              : undefined
          }
        />
      ) : null}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  )
}
