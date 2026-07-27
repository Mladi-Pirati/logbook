"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { ticketComments, tickets } from "@/db/schema"
import { requireUser } from "@/lib/auth/session"
import { syncTicketCommentToDiscord } from "@/lib/discord/comments"

const createCommentSchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
})

const updateCommentSchema = z.object({
  commentId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
})

const commentIdSchema = z.string().uuid()

async function findOwnedLogbookComment(commentId: string, userId: string) {
  const comment = await db.query.ticketComments.findFirst({
    where: eq(ticketComments.id, commentId),
    with: { ticket: { with: { project: true } } },
  })

  if (
    !comment ||
    comment.source !== "logbook" ||
    comment.authorUserId !== userId
  ) {
    return null
  }
  return comment
}

function revalidateCommentTicket(ticketId: string, projectKey: string) {
  revalidatePath("/(app)/tickets/[key]", "page")
  revalidatePath(`/projects/${projectKey}/board`)
}

export async function createTicketComment(raw: unknown) {
  const user = await requireUser()
  const parsed = createCommentSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: "invalid_comment" }
  }

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, parsed.data.ticketId),
    with: { project: true },
  })
  if (!ticket) return { ok: false as const, error: "ticket_not_found" }

  const [comment] = await db
    .insert(ticketComments)
    .values({
      ticketId: ticket.id,
      body: parsed.data.body,
      source: "logbook",
      authorUserId: user.helmUserId,
      syncStatus: "pending",
      pendingOperation: "create",
    })
    .returning({ id: ticketComments.id })

  const sync = await syncTicketCommentToDiscord(comment.id)
  revalidateCommentTicket(ticket.id, ticket.project.key)
  return { ok: true as const, synced: sync.ok, commentId: comment.id }
}

export async function updateTicketComment(raw: unknown) {
  const user = await requireUser()
  const parsed = updateCommentSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: "invalid_comment" }
  }

  const comment = await findOwnedLogbookComment(
    parsed.data.commentId,
    user.helmUserId,
  )
  if (!comment || comment.deletedAt) {
    return { ok: false as const, error: "comment_not_found" }
  }

  await db
    .update(ticketComments)
    .set({
      body: parsed.data.body,
      editedAt: new Date(),
      syncStatus: "pending",
      pendingOperation: comment.discordMessageId ? "update" : "create",
      lastSyncError: null,
    })
    .where(eq(ticketComments.id, comment.id))

  const sync = await syncTicketCommentToDiscord(comment.id)
  revalidateCommentTicket(comment.ticketId, comment.ticket.project.key)
  return { ok: true as const, synced: sync.ok }
}

export async function deleteTicketComment(raw: unknown) {
  const user = await requireUser()
  const parsed = commentIdSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: "invalid_comment" }
  }

  const comment = await findOwnedLogbookComment(
    parsed.data,
    user.helmUserId,
  )
  if (!comment) return { ok: false as const, error: "comment_not_found" }

  const needsDiscordDelete = Boolean(comment.discordMessageId)
  await db
    .update(ticketComments)
    .set({
      body: null,
      attachments: [],
      deletedAt: comment.deletedAt ?? new Date(),
      syncStatus: needsDiscordDelete ? "pending" : "synced",
      pendingOperation: needsDiscordDelete ? "delete" : null,
      lastSyncError: null,
    })
    .where(eq(ticketComments.id, comment.id))

  const sync = needsDiscordDelete
    ? await syncTicketCommentToDiscord(comment.id)
    : { ok: true as const }
  revalidateCommentTicket(comment.ticketId, comment.ticket.project.key)
  return { ok: true as const, synced: sync.ok }
}

export async function retryTicketCommentSync(raw: unknown) {
  const user = await requireUser()
  const parsed = commentIdSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: "invalid_comment" }
  }

  const comment = await findOwnedLogbookComment(
    parsed.data,
    user.helmUserId,
  )
  if (!comment || comment.syncStatus !== "failed" || !comment.pendingOperation) {
    return { ok: false as const, error: "comment_not_retryable" }
  }

  const sync = await syncTicketCommentToDiscord(comment.id)
  revalidateCommentTicket(comment.ticketId, comment.ticket.project.key)
  return { ok: true as const, synced: sync.ok }
}
