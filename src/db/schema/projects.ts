import {
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"
import { users } from "./users"

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  leadUserId: text("lead_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  color: text("color").notNull().default("#6366f1"),
  icon: text("icon").notNull().default("📋"),
  nextTicketNumber: integer("next_ticket_number").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
})

export const labels = pgTable(
  "labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
  },
  (t) => [unique().on(t.projectId, t.name)],
)
