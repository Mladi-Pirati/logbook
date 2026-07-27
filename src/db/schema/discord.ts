import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { tickets } from "./tickets"

export const ticketDiscordMessages = pgTable(
  "ticket_discord_messages",
  {
    ticketId: uuid("ticket_id")
      .primaryKey()
      .references(() => tickets.id, { onDelete: "cascade" }),
    channelId: text("channel_id").notNull(),
    messageId: text("message_id").notNull(),
    threadId: text("thread_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("ticket_discord_messages_thread_id_uq").on(table.threadId),
  ],
)
