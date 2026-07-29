import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { ticketComments } from "@/db/schema"
import { verifyIntegrationAuth } from "@/lib/discord/api"
import { EMPTY_RICH_TEXT_DOCUMENT, plainTextToRichText } from "@/lib/rich-text"

const attachmentSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1).max(255),
  url: z.string().url(),
  contentType: z.string().nullable(),
  size: z.number().int().nonnegative(),
})

const updateDiscordCommentSchema = z
  .object({
    content: z.string().max(2000),
    attachments: z.array(attachmentSchema).max(25).default([]),
    editedAt: z.string().datetime(),
  })
  .refine(
    (value) => value.content.trim().length > 0 || value.attachments.length > 0,
    { message: "Comment content or an attachment is required" },
  )

async function findComment(messageId: string) {
  return db.query.ticketComments.findFirst({
    where: eq(ticketComments.discordMessageId, messageId),
    with: { ticket: { with: { project: true } } },
  })
}

function revalidateComment(
  comment: NonNullable<Awaited<ReturnType<typeof findComment>>>,
) {
  revalidatePath("/(app)/tickets/[key]", "page")
  revalidatePath(`/projects/${comment.ticket.project.key}/board`)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const unauthorized = verifyIntegrationAuth(request)
  if (unauthorized) return unauthorized

  const parsed = updateDiscordCommentSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_request", errors: parsed.error.issues },
      { status: 400 },
    )
  }

  const { messageId } = await params
  const comment = await findComment(messageId)
  if (!comment) {
    return NextResponse.json(
      { ok: false, error: "comment_not_found" },
      { status: 404 },
    )
  }
  if (comment.source !== "discord") {
    return NextResponse.json(
      { ok: false, error: "origin_mismatch" },
      { status: 409 },
    )
  }

  await db
    .update(ticketComments)
    .set({
      body: parsed.data.content.trim() || null,
      bodyDocument: plainTextToRichText(parsed.data.content.trim() || null),
      attachments: parsed.data.attachments,
      editedAt: new Date(parsed.data.editedAt),
      deletedAt: null,
    })
    .where(eq(ticketComments.id, comment.id))
  revalidateComment(comment)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const unauthorized = verifyIntegrationAuth(request)
  if (unauthorized) return unauthorized

  const { messageId } = await params
  const comment = await findComment(messageId)
  if (!comment) {
    return NextResponse.json({ ok: true })
  }
  if (comment.source !== "discord") {
    return NextResponse.json(
      { ok: false, error: "origin_mismatch" },
      { status: 409 },
    )
  }

  await db
    .update(ticketComments)
    .set({
      body: null,
      bodyDocument: EMPTY_RICH_TEXT_DOCUMENT,
      attachments: [],
      deletedAt: comment.deletedAt ?? new Date(),
    })
    .where(eq(ticketComments.id, comment.id))
  revalidateComment(comment)
  return NextResponse.json({ ok: true })
}
