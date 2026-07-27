import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { z } from "zod"
import {
  verifyIntegrationAuth,
  resolveDiscordUser,
  userNotLinkedResponse,
} from "@/lib/discord/api"
import { updateTicketCore } from "@/lib/tickets"
import { syncTicketToDiscordSafely } from "@/lib/discord/notify"
import { getTicketDiscordPayload } from "@/lib/discord/payload"
import { plainTextToRichText } from "@/lib/rich-text"
import { cleanupTicketAttachmentObjects } from "@/lib/ticket-attachments"

const updateTicketSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional(),
  discordUserId: z.string(),
})

const idSchema = z.string().uuid()

export async function GET(
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

  const payload = await getTicketDiscordPayload(id)
  if (!payload) {
    return NextResponse.json(
      { ok: false, error: "ticket_not_found" },
      { status: 404 },
    )
  }

  return NextResponse.json({ ok: true, ...payload })
}

export async function PATCH(
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
  const parsed = updateTicketSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errors: parsed.error.issues },
      { status: 400 },
    )
  }

  const { title, description, priority, discordUserId } = parsed.data

  const user = await resolveDiscordUser(discordUserId)
  if (!user) return userNotLinkedResponse()

  const payload = await getTicketDiscordPayload(id)
  if (!payload) {
    return NextResponse.json(
      { ok: false, error: "ticket_not_found" },
      { status: 404 },
    )
  }

  await updateTicketCore({
    id,
    title,
    descriptionDocument:
      description !== undefined ? plainTextToRichText(description) : undefined,
    priority,
  })
  after(() => cleanupTicketAttachmentObjects())

  await syncTicketToDiscordSafely(id)
  revalidatePath(`/projects/${payload.project.key}/board`)
  revalidatePath("/(app)/tickets/[key]", "page")

  const updatedPayload = await getTicketDiscordPayload(id)

  return NextResponse.json({ ok: true, ...updatedPayload })
}
