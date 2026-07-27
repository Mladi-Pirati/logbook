import { pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  discordUserId: text("discord_user_id").unique(),
  profilePictureVersion: text("profile_picture_version"),
  profilePictureBlurhash: text("profile_picture_blurhash"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
})

export const helmDirectorySyncs = pgTable("helm_directory_syncs", {
  key: text("key").primaryKey(),
  lastCompletedAt: timestamp("last_completed_at", { withTimezone: true }),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
})
