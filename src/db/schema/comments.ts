import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import {
  ticketCommentSource,
  ticketCommentSyncOperation,
  ticketCommentSyncStatus,
} from "./enums"
import { tickets } from "./tickets"
import { users } from "./users"

export type TicketCommentAttachment = {
  id: string
  fileName: string
  url: string
  contentType: string | null
  size: number
}

export const ticketComments = pgTable(
  "ticket_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    body: text("body"),
    attachments: jsonb("attachments")
      .$type<TicketCommentAttachment[]>()
      .notNull()
      .default([]),
    source: ticketCommentSource("source").notNull(),
    authorUserId: text("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    discordUserId: text("discord_user_id"),
    discordUsername: text("discord_username"),
    discordDisplayName: text("discord_display_name"),
    discordAvatarUrl: text("discord_avatar_url"),
    discordMessageId: text("discord_message_id"),
    discordMessageUrl: text("discord_message_url"),
    syncStatus: ticketCommentSyncStatus("sync_status")
      .notNull()
      .default("pending"),
    pendingOperation: ticketCommentSyncOperation("pending_operation"),
    lastSyncError: text("last_sync_error"),
    lastSyncAttemptAt: timestamp("last_sync_attempt_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("ticket_comments_ticket_created_idx").on(
      table.ticketId,
      table.createdAt,
    ),
    uniqueIndex("ticket_comments_discord_message_id_uq").on(
      table.discordMessageId,
    ),
  ],
)
