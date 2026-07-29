"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { and, eq, inArray, isNull, notInArray } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { commentAttachments, ticketComments, tickets } from "@/db/schema"
import { requireUser } from "@/lib/auth/session"
import { syncTicketCommentToDiscord } from "@/lib/discord/comments"
import {
  EMPTY_RICH_TEXT_DOCUMENT,
  getRichTextAttachmentIds,
  isEmptyRichTextDocument,
  richTextDocumentSchema,
  richTextToPlainText,
  type RichTextDocument,
} from "@/lib/rich-text"
import { resolveRichTextMentionNames } from "@/lib/rich-text-server"
import { cleanupCommentAttachmentObjects } from "@/lib/ticket-attachments"

const createCommentSchema = z.object({
  ticketId: z.string().uuid(),
  bodyDocument: richTextDocumentSchema,
  draftId: z.string().uuid(),
})

const updateCommentSchema = z.object({
  commentId: z.string().uuid(),
  bodyDocument: richTextDocumentSchema,
  draftId: z.string().uuid(),
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

async function commentBodyProjection(
  executor: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0],
  document: RichTextDocument,
) {
  if (isEmptyRichTextDocument(document)) {
    throw new Error("Comment cannot be empty")
  }
  const mentionNames = await resolveRichTextMentionNames(executor, document)
  const body = richTextToPlainText(document, { mentions: mentionNames })
  if (body && body.length > 2000) {
    throw new Error("Comment exceeds 2000 characters")
  }
  return body
}

export async function createTicketComment(raw: unknown) {
  const user = await requireUser()
  const parsed = createCommentSchema.safeParse(raw)
  if (!parsed.success) {
    console.warn(
      "[comments] Rejected create payload",
      parsed.error.issues.map(({ code, message, path }) => ({
        code,
        message,
        path,
      })),
    )
    return { ok: false as const, error: "invalid_comment" }
  }

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, parsed.data.ticketId),
    with: { project: true },
  })
  if (!ticket) return { ok: false as const, error: "ticket_not_found" }

  let comment: { id: string }
  try {
    comment = await db.transaction(async (tx) => {
      const body = await commentBodyProjection(tx, parsed.data.bodyDocument)
      const attachmentIds = getRichTextAttachmentIds(parsed.data.bodyDocument)
      if (attachmentIds.length > 0) {
        const attachments = await tx
          .select({
            id: commentAttachments.id,
            draftId: commentAttachments.draftId,
            uploadedById: commentAttachments.uploadedById,
            deletedAt: commentAttachments.deletedAt,
          })
          .from(commentAttachments)
          .where(inArray(commentAttachments.id, attachmentIds))
        if (
          attachments.length !== attachmentIds.length ||
          attachments.some(
            (attachment) =>
              attachment.draftId !== parsed.data.draftId ||
              attachment.uploadedById !== user.helmUserId ||
              attachment.deletedAt !== null,
          )
        ) {
          throw new Error("Invalid comment attachment reference")
        }
      }

      const [created] = await tx
        .insert(ticketComments)
        .values({
          ticketId: ticket.id,
          body,
          bodyDocument: parsed.data.bodyDocument,
          source: "logbook",
          authorUserId: user.helmUserId,
          syncStatus: "pending",
          pendingOperation: "create",
        })
        .returning({ id: ticketComments.id })

      if (attachmentIds.length > 0) {
        await tx
          .update(commentAttachments)
          .set({
            commentId: created.id,
            draftId: null,
            claimedAt: new Date(),
          })
          .where(inArray(commentAttachments.id, attachmentIds))
      }
      return created
    })
  } catch (error) {
    console.error("[comments] Failed to create comment", error)
    return { ok: false as const, error: "invalid_comment" }
  }

  const sync = await syncTicketCommentToDiscord(comment.id)
  after(() => cleanupCommentAttachmentObjects())
  revalidateCommentTicket(ticket.id, ticket.project.key)
  return { ok: true as const, synced: sync.ok, commentId: comment.id }
}

export async function updateTicketComment(raw: unknown) {
  const user = await requireUser()
  const parsed = updateCommentSchema.safeParse(raw)
  if (!parsed.success) {
    console.warn(
      "[comments] Rejected update payload",
      parsed.error.issues.map(({ code, message, path }) => ({
        code,
        message,
        path,
      })),
    )
    return { ok: false as const, error: "invalid_comment" }
  }

  const comment = await findOwnedLogbookComment(
    parsed.data.commentId,
    user.helmUserId,
  )
  if (!comment || comment.deletedAt) {
    return { ok: false as const, error: "comment_not_found" }
  }

  try {
    await db.transaction(async (tx) => {
      const body = await commentBodyProjection(tx, parsed.data.bodyDocument)
      const attachmentIds = getRichTextAttachmentIds(parsed.data.bodyDocument)
      const referenced =
        attachmentIds.length > 0
          ? await tx
              .select({
                id: commentAttachments.id,
                commentId: commentAttachments.commentId,
                draftId: commentAttachments.draftId,
                uploadedById: commentAttachments.uploadedById,
                deletedAt: commentAttachments.deletedAt,
              })
              .from(commentAttachments)
              .where(inArray(commentAttachments.id, attachmentIds))
          : []

      if (
        referenced.length !== attachmentIds.length ||
        referenced.some((attachment) => {
          if (attachment.deletedAt) return true
          if (attachment.commentId === comment.id) return false
          return (
            attachment.commentId !== null ||
            attachment.draftId !== parsed.data.draftId ||
            attachment.uploadedById !== user.helmUserId
          )
        })
      ) {
        throw new Error("Invalid comment attachment reference")
      }

      const draftAttachmentIds = referenced
        .filter((attachment) => attachment.commentId === null)
        .map((attachment) => attachment.id)
      if (draftAttachmentIds.length > 0) {
        await tx
          .update(commentAttachments)
          .set({
            commentId: comment.id,
            draftId: null,
            claimedAt: new Date(),
          })
          .where(inArray(commentAttachments.id, draftAttachmentIds))
      }

      const removalWhere =
        attachmentIds.length > 0
          ? and(
              eq(commentAttachments.commentId, comment.id),
              isNull(commentAttachments.deletedAt),
              notInArray(commentAttachments.id, attachmentIds),
            )
          : and(
              eq(commentAttachments.commentId, comment.id),
              isNull(commentAttachments.deletedAt),
            )
      await tx
        .update(commentAttachments)
        .set({ deletedAt: new Date() })
        .where(removalWhere)

      await tx
        .update(ticketComments)
        .set({
          body,
          bodyDocument: parsed.data.bodyDocument,
          editedAt: new Date(),
          syncStatus: "pending",
          pendingOperation: comment.discordMessageId ? "update" : "create",
          lastSyncError: null,
        })
        .where(eq(ticketComments.id, comment.id))
    })
  } catch (error) {
    console.error("[comments] Failed to update comment", error)
    return { ok: false as const, error: "invalid_comment" }
  }

  const sync = await syncTicketCommentToDiscord(comment.id)
  after(() => cleanupCommentAttachmentObjects())
  revalidateCommentTicket(comment.ticketId, comment.ticket.project.key)
  return { ok: true as const, synced: sync.ok }
}

export async function deleteTicketComment(raw: unknown) {
  const user = await requireUser()
  const parsed = commentIdSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: "invalid_comment" }
  }

  const comment = await findOwnedLogbookComment(parsed.data, user.helmUserId)
  if (!comment) return { ok: false as const, error: "comment_not_found" }

  const needsDiscordDelete = Boolean(comment.discordMessageId)
  await db.transaction(async (tx) => {
    await tx
      .update(commentAttachments)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(commentAttachments.commentId, comment.id),
          isNull(commentAttachments.deletedAt),
        ),
      )
    await tx
      .update(ticketComments)
      .set({
        body: null,
        bodyDocument: EMPTY_RICH_TEXT_DOCUMENT,
        attachments: [],
        deletedAt: comment.deletedAt ?? new Date(),
        syncStatus: needsDiscordDelete ? "pending" : "synced",
        pendingOperation: needsDiscordDelete ? "delete" : null,
        lastSyncError: null,
      })
      .where(eq(ticketComments.id, comment.id))
  })

  const sync = needsDiscordDelete
    ? await syncTicketCommentToDiscord(comment.id)
    : { ok: true as const }
  after(() => cleanupCommentAttachmentObjects())
  revalidateCommentTicket(comment.ticketId, comment.ticket.project.key)
  return { ok: true as const, synced: sync.ok }
}

export async function retryTicketCommentSync(raw: unknown) {
  const user = await requireUser()
  const parsed = commentIdSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: "invalid_comment" }
  }

  const comment = await findOwnedLogbookComment(parsed.data, user.helmUserId)
  if (
    !comment ||
    comment.syncStatus !== "failed" ||
    !comment.pendingOperation
  ) {
    return { ok: false as const, error: "comment_not_retryable" }
  }

  const sync = await syncTicketCommentToDiscord(comment.id)
  revalidateCommentTicket(comment.ticketId, comment.ticket.project.key)
  return { ok: true as const, synced: sync.ok }
}
