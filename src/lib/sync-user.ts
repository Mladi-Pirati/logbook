import { db } from "@/db"
import { users } from "@/db/schema"

export async function upsertUser(user: {
  id: string
  username: string
  firstName: string
  lastName: string
  discordUserId?: string
  profilePicture?: { version: string; blurhash: string } | null
}) {
  await db
    .insert(users)
    .values({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      discordUserId: user.discordUserId,
      profilePictureVersion: user.profilePicture?.version ?? null,
      profilePictureBlurhash: user.profilePicture?.blurhash ?? null,
      syncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        // Only touch the mapping when the caller provides one, so a member
        // sync without discord data never clears an existing link.
        ...(user.discordUserId !== undefined
          ? { discordUserId: user.discordUserId }
          : {}),
        ...(user.profilePicture !== undefined
          ? {
              profilePictureVersion: user.profilePicture?.version ?? null,
              profilePictureBlurhash: user.profilePicture?.blurhash ?? null,
            }
          : {}),
        syncedAt: new Date(),
      },
    })
}
