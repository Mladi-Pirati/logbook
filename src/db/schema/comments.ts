import {
  boolean,
  check,
  integer,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import {
  ticketCommentSource,
  ticketCommentSyncOperation,
  ticketCommentSyncStatus,
} from "./enums"
import { tickets } from "./tickets"
import { users } from "./users"
import type { RichTextDocument } from "@/lib/rich-text"

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
    bodyDocument: jsonb("body_document")
      .$type<RichTextDocument>()
      .notNull()
      .default({
        type: "doc",
        content: [{ type: "paragraph" }],
      }),
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

export const commentAttachments = pgTable(
  "comment_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    commentId: uuid("comment_id").references(() => ticketComments.id, {
      onDelete: "restrict",
    }),
    draftId: uuid("draft_id"),
    uploadedById: text("uploaded_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    objectKey: text("object_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    isInline: boolean("is_inline").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("comment_attachments_object_key_uq").on(table.objectKey),
    index("comment_attachments_comment_idx").on(table.commentId),
    index("comment_attachments_draft_idx").on(table.draftId),
    index("comment_attachments_cleanup_idx").on(
      table.deletedAt,
      table.createdAt,
    ),
    check(
      "comment_attachments_owner_ck",
      sql`((${table.commentId} is not null)::int + (${table.draftId} is not null)::int) = 1`,
    ),
    check("comment_attachments_size_ck", sql`${table.size} >= 0`),
  ],
)
