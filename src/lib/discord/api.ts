import { createHash, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import { users } from "@/db/schema"

function safeEqual(a: string, b: string) {
  // Hashing normalizes lengths so timingSafeEqual never throws.
  const hashA = createHash("sha256").update(a).digest()
  const hashB = createHash("sha256").update(b).digest()
  return timingSafeEqual(hashA, hashB)
}

export function verifyIntegrationAuth(request: Request) {
  const secret = process.env.DISCORD_INTEGRATION_SECRET
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "integration_not_configured" },
      { status: 503 },
    )
  }

  const authorization = request.headers.get("authorization")
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : null
  if (!token || !safeEqual(token, secret)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    )
  }

  return null
}

export async function resolveDiscordUser(discordUserId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.discordUserId, discordUserId),
  })
  return user ?? null
}

export async function validateAssigneeIds(assigneeIds: string[]) {
  const unique = [...new Set(assigneeIds)]
  if (unique.length === 0) return { ok: true as const, assigneeIds: unique }
  const found = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, unique))
  if (found.length !== unique.length) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "invalid_assignee" },
        { status: 400 },
      ),
    }
  }
  return { ok: true as const, assigneeIds: unique }
}

export function userNotLinkedResponse() {
  return NextResponse.json(
    { ok: false, error: "user_not_linked" },
    { status: 403 },
  )
}
