import { pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
})
