import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import {
  ticketComments,
  ticketDiscordMessages,
  users,
} from "@/db/schema"
import { verifyIntegrationAuth } from "@/lib/discord/api"

const attachmentSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1).max(255),
  url: z.string().url(),
  contentType: z.string().nullable(),
  size: z.number().int().nonnegative(),
})

const createDiscordCommentSchema = z
  .object({
    threadId: z.string().min(1),
    messageId: z.string().min(1),
    messageUrl: z.string().url(),
    content: z.string().max(2000),
    attachments: z.array(attachmentSchema).max(25).default([]),
    author: z.object({
      discordUserId: z.string().min(1),
      username: z.string().min(1),
      displayName: z.string().min(1),
      avatarUrl: z.string().url().nullable(),
    }),
    createdAt: z.string().datetime(),
  })
  .refine(
    (value) => value.content.trim().length > 0 || value.attachments.length > 0,
    { message: "Comment content or an attachment is required" },
  )

export async function POST(request: Request) {
  const unauthorized = verifyIntegrationAuth(request)
  if (unauthorized) return unauthorized

  const parsed = createDiscordCommentSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_request", errors: parsed.error.issues },
      { status: 400 },
    )
  }

  const mapping = await db.query.ticketDiscordMessages.findFirst({
    where: eq(ticketDiscordMessages.threadId, parsed.data.threadId),
    with: { ticket: { with: { project: true } } },
  })
  if (!mapping) {
    return NextResponse.json(
      { ok: false, error: "thread_not_linked" },
      { status: 404 },
    )
  }

  const linkedUser = await db.query.users.findFirst({
    where: eq(users.discordUserId, parsed.data.author.discordUserId),
  })
  const body = parsed.data.content.trim() || null

  const [inserted] = await db
    .insert(ticketComments)
    .values({
      ticketId: mapping.ticketId,
      body,
      attachments: parsed.data.attachments,
      source: "discord",
      authorUserId: linkedUser?.id ?? null,
      discordUserId: parsed.data.author.discordUserId,
      discordUsername: parsed.data.author.username,
      discordDisplayName: parsed.data.author.displayName,
      discordAvatarUrl: parsed.data.author.avatarUrl,
      discordMessageId: parsed.data.messageId,
      discordMessageUrl: parsed.data.messageUrl,
      syncStatus: "synced",
      pendingOperation: null,
      createdAt: new Date(parsed.data.createdAt),
    })
    .onConflictDoNothing({ target: ticketComments.discordMessageId })
    .returning({ id: ticketComments.id })
  const comment =
    inserted ??
    (await db.query.ticketComments.findFirst({
      where: eq(ticketComments.discordMessageId, parsed.data.messageId),
      columns: { id: true },
    }))

  if (!comment) {
    return NextResponse.json(
      { ok: false, error: "comment_persist_failed" },
      { status: 500 },
    )
  }

  revalidatePath("/(app)/tickets/[key]", "page")
  revalidatePath(`/projects/${mapping.ticket.project.key}/board`)

  return NextResponse.json({ ok: true, commentId: comment.id })
}
