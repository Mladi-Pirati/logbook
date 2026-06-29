import {
  doublePrecision,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"
import { ticketPriority } from "./enums"
import { labels, projects } from "./projects"
import { columns } from "./boards"
import { users } from "./users"

export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    columnId: uuid("column_id")
      .notNull()
      .references(() => columns.id, { onDelete: "restrict" }),
    parentId: uuid("parent_id"),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    estimate: integer("estimate"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    position: doublePrecision("position").notNull(),
    priority: ticketPriority("priority").notNull().default("none"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    unique("tickets_project_number_uq").on(t.projectId, t.number),
    foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.id],
      name: "tickets_parent_fk",
    }).onDelete("cascade"),
    index("tickets_column_position_idx").on(t.columnId, t.position),
  ],
)

export const ticketAssignees = pgTable(
  "ticket_assignees",
  {
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.ticketId, t.userId] })],
)

export const ticketLabels = pgTable(
  "ticket_labels",
  {
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.ticketId, t.labelId] })],
)
