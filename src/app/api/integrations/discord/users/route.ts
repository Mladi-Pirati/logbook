import { NextResponse } from "next/server"
import { asc } from "drizzle-orm"
import { db } from "@/db"
import { users } from "@/db/schema"
import { verifyIntegrationAuth } from "@/lib/discord/api"

export async function GET(request: Request) {
  const unauthorized = verifyIntegrationAuth(request)
  if (unauthorized) return unauthorized

  const allUsers = await db
    .select({
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      discordUserId: users.discordUserId,
    })
    .from(users)
    .orderBy(asc(users.firstName), asc(users.lastName))

  return NextResponse.json({
    ok: true,
    users: allUsers.map((user) => ({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      username: user.username,
      discordUserId: user.discordUserId,
    })),
  })
}
