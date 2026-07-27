import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { ticketDiscordMessages } from "@/db/schema"
import { getTicketDiscordPayload, type TicketDiscordPayload } from "./payload"

const messageResponseSchema = z.object({
  channelId: z.string(),
  messageId: z.string(),
  threadId: z.string(),
})

export function getDiscordBotConfig() {
  const url = process.env.DISCORD_BOT_URL
  const secret = process.env.DISCORD_BOT_SECRET
  if (!url || !secret) return null
  return { url: url.replace(/\/$/, ""), secret }
}

type BotConfig = NonNullable<ReturnType<typeof getDiscordBotConfig>>

export async function callDiscordBot(
  config: BotConfig,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  payload: unknown,
) {
  return fetch(`${config.url}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
}

async function postTicketMessage(
  config: BotConfig,
  ticketId: string,
  payload: TicketDiscordPayload,
) {
  const response = await callDiscordBot(
    config,
    "POST",
    "/api/tickets/message",
    payload,
  )
  if (!response.ok) {
    throw new Error(`Discord bot responded ${response.status} to message post`)
  }
  const { channelId, messageId, threadId } = messageResponseSchema.parse(
    await response.json(),
  )
  await db
    .insert(ticketDiscordMessages)
    .values({ ticketId, channelId, messageId, threadId })
    .onConflictDoUpdate({
      target: ticketDiscordMessages.ticketId,
      set: { channelId, messageId, threadId },
    })
}

export async function syncTicketToDiscord(ticketId: string) {
  const config = getDiscordBotConfig()
  if (!config) return

  const payload = await getTicketDiscordPayload(ticketId)
  if (!payload) return

  const existing = await db.query.ticketDiscordMessages.findFirst({
    where: eq(ticketDiscordMessages.ticketId, ticketId),
  })

  if (!existing) {
    await postTicketMessage(config, ticketId, payload)
    return
  }

  const response = await callDiscordBot(
    config,
    "PUT",
    `/api/tickets/message/${existing.messageId}`,
    payload,
  )
  if (response.status === 404) {
    await db
      .delete(ticketDiscordMessages)
      .where(eq(ticketDiscordMessages.ticketId, ticketId))
    await postTicketMessage(config, ticketId, payload)
    return
  }
  if (!response.ok) {
    throw new Error(`Discord bot responded ${response.status} to message edit`)
  }

  const message = messageResponseSchema.parse(await response.json())
  await db
    .update(ticketDiscordMessages)
    .set({
      channelId: message.channelId,
      messageId: message.messageId,
      threadId: message.threadId,
    })
    .where(eq(ticketDiscordMessages.ticketId, ticketId))
}

export async function syncTicketToDiscordSafely(ticketId: string) {
  try {
    await syncTicketToDiscord(ticketId)
  } catch (error) {
    console.error("Failed to sync ticket to Discord", {
      ticketId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
