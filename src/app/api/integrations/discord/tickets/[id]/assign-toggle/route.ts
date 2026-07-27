import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { verifyIntegrationAuth, resolveDiscordUser, userNotLinkedResponse } from "@/lib/discord/api"
import { toggleTicketAssignee } from "@/lib/tickets"
import { syncTicketToDiscordSafely } from "@/lib/discord/notify"
import { getTicketDiscordPayload } from "@/lib/discord/payload"

const toggleAssigneeSchema = z.object({
  discordUserId: z.string(),
})

const idSchema = z.string().uuid()

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = verifyIntegrationAuth(request)
  if (unauthorized) return unauthorized

  const { id } = await params

  const idValidation = idSchema.safeParse(id)
  if (!idValidation.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_id" },
      { status: 400 },
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = toggleAssigneeSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errors: parsed.error.issues },
      { status: 400 },
    )
  }

  const { discordUserId } = parsed.data

  const user = await resolveDiscordUser(discordUserId)
  if (!user) return userNotLinkedResponse()

  const payload = await getTicketDiscordPayload(id)
  if (!payload) {
    return NextResponse.json(
      { ok: false, error: "ticket_not_found" },
      { status: 404 },
    )
  }

  const { assigned } = await toggleTicketAssignee(id, user.id)

  await syncTicketToDiscordSafely(id)
  revalidatePath(`/projects/${payload.project.key}/board`)
  revalidatePath("/(app)/tickets/[key]", "page")

  const updatedPayload = await getTicketDiscordPayload(id)

  return NextResponse.json({
    ok: true,
    assigned,
    ...updatedPayload,
  })
}
