import { NextResponse } from "next/server"
import { and, eq, isNull, ne } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { ticketComments, users } from "@/db/schema"
import { verifyIntegrationAuth } from "@/lib/discord/api"
import { upsertUser } from "@/lib/sync-user"

const linkUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  discordUserId: z.string(),
})

export async function POST(request: Request) {
  const unauthorized = verifyIntegrationAuth(request)
  if (unauthorized) return unauthorized

  const body = await request.json().catch(() => null)
  const parsed = linkUserSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errors: parsed.error.issues },
      { status: 400 },
    )
  }

  const { id, username, firstName, lastName, discordUserId } = parsed.data

  await db
    .update(users)
    .set({ discordUserId: null })
    .where(
      and(
        eq(users.discordUserId, discordUserId),
        ne(users.id, id),
      ),
    )

  await upsertUser({ id, username, firstName, lastName, discordUserId })

  await db
    .update(ticketComments)
    .set({ authorUserId: id })
    .where(
      and(
        eq(ticketComments.discordUserId, discordUserId),
        isNull(ticketComments.authorUserId),
      ),
    )

  return NextResponse.json({ ok: true })
}
