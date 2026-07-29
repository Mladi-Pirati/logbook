import { eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import {
  commentAttachments,
  ticketComments,
  ticketDiscordMessages,
} from "@/db/schema"
import { richTextToDiscordMarkdown } from "@/lib/rich-text"
import { resolveRichTextMentionNames } from "@/lib/rich-text-server"
import {
  callDiscordBot,
  getDiscordBotConfig,
  syncTicketToDiscord,
} from "./notify"

const commentMessageResponseSchema = z.object({
  messageId: z.string(),
  messageUrl: z.string().url(),
})

function safeSyncError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/Bearer\s+\S+/gi, "Bearer [redacted]").slice(0, 300)
}

async function getThread(ticketId: string) {
  let mapping = await db.query.ticketDiscordMessages.findFirst({
    where: eq(ticketDiscordMessages.ticketId, ticketId),
  })

  if (!mapping?.threadId) {
    await syncTicketToDiscord(ticketId)
    mapping = await db.query.ticketDiscordMessages.findFirst({
      where: eq(ticketDiscordMessages.ticketId, ticketId),
    })
  }

  if (!mapping?.threadId) {
    throw new Error("Discord ticket thread is unavailable")
  }

  return mapping.threadId
}

export async function syncTicketCommentToDiscord(commentId: string) {
  const config = getDiscordBotConfig()
  if (!config) {
    await markFailed(commentId, "Discord integration is not configured")
    return { ok: false as const, error: "integration_not_configured" }
  }

  const comment = await db.query.ticketComments.findFirst({
    where: eq(ticketComments.id, commentId),
    with: {
      author: true,
      richAttachments: {
        where: isNull(commentAttachments.deletedAt),
      },
    },
  })
  if (!comment || comment.source !== "logbook" || !comment.pendingOperation) {
    return { ok: false as const, error: "comment_not_syncable" }
  }

  await db
    .update(ticketComments)
    .set({ syncStatus: "pending", lastSyncAttemptAt: new Date() })
    .where(eq(ticketComments.id, commentId))

  try {
    const threadId = await getThread(comment.ticketId)
    const mentionNames =
      comment.pendingOperation === "delete"
        ? new Map<string, string>()
        : await resolveRichTextMentionNames(db, comment.bodyDocument)
    const content =
      comment.pendingOperation === "delete"
        ? null
        : richTextToDiscordMarkdown(comment.bodyDocument, {
            baseUrl: (process.env.AUTH_URL ?? "").replace(/\/$/, ""),
            attachments: new Map(
              comment.richAttachments.map((attachment) => [
                attachment.id,
                { fileName: attachment.fileName },
              ]),
            ),
            attachmentBasePath: "/api/comment-attachments",
            mentions: mentionNames,
          })

    if (comment.pendingOperation === "create") {
      if (!comment.author || !content) {
        throw new Error("Comment author or body is unavailable")
      }
      const response = await callDiscordBot(
        config,
        "POST",
        `/api/tickets/${comment.ticketId}/comments`,
        {
          threadId,
          commentId: comment.id,
          content,
          author: {
            helmUserId: comment.author.id,
            firstName: comment.author.firstName,
            lastName: comment.author.lastName,
            discordUserId: comment.author.discordUserId ?? null,
          },
        },
      )
      if (!response.ok) {
        throw new Error(
          `Discord bot responded ${response.status} to comment post`,
        )
      }
      const sent = commentMessageResponseSchema.parse(await response.json())
      await db
        .update(ticketComments)
        .set({
          discordMessageId: sent.messageId,
          discordMessageUrl: sent.messageUrl,
          syncStatus: "synced",
          pendingOperation: null,
          lastSyncError: null,
        })
        .where(eq(ticketComments.id, comment.id))
      return { ok: true as const }
    }

    if (!comment.discordMessageId) {
      throw new Error("Discord message ID is unavailable")
    }

    const response = await callDiscordBot(
      config,
      comment.pendingOperation === "update" ? "PATCH" : "DELETE",
      `/api/tickets/${comment.ticketId}/comments/${comment.discordMessageId}`,
      {
        threadId,
        ...(comment.pendingOperation === "update"
          ? { content: content ?? "" }
          : {}),
      },
    )
    const missingDeleteIsComplete =
      comment.pendingOperation === "delete" && response.status === 404
    if (!response.ok && !missingDeleteIsComplete) {
      throw new Error(
        `Discord bot responded ${response.status} to comment ${comment.pendingOperation}`,
      )
    }

    await db
      .update(ticketComments)
      .set({
        syncStatus: "synced",
        pendingOperation: null,
        lastSyncError: null,
      })
      .where(eq(ticketComments.id, comment.id))
    return { ok: true as const }
  } catch (error) {
    await markFailed(comment.id, safeSyncError(error))
    return { ok: false as const, error: "discord_sync_failed" }
  }
}

async function markFailed(commentId: string, error: string) {
  await db
    .update(ticketComments)
    .set({
      syncStatus: "failed",
      lastSyncError: error,
      lastSyncAttemptAt: new Date(),
    })
    .where(eq(ticketComments.id, commentId))
}
