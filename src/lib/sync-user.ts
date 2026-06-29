import { db } from "@/db"
import { users } from "@/db/schema"

export async function upsertUser(user: {
  id: string
  username: string
  firstName: string
  lastName: string
}) {
  await db
    .insert(users)
    .values({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      syncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        syncedAt: new Date(),
      },
    })
}
