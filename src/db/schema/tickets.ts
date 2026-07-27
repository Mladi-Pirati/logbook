import {
  boolean,
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { ticketPriority } from "./enums"
import { labels, projects } from "./projects"
import { columns } from "./boards"
import { users } from "./users"
import type { RichTextDocument } from "@/lib/rich-text"

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
    descriptionDocument: jsonb("description_document")
      .$type<RichTextDocument>()
      .notNull()
      .default({
        type: "doc",
        content: [{ type: "paragraph" }],
      }),
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

export const ticketAttachments = pgTable(
  "ticket_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id").references(() => tickets.id, {
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
  (t) => [
    uniqueIndex("ticket_attachments_object_key_uq").on(t.objectKey),
    index("ticket_attachments_ticket_idx").on(t.ticketId),
    index("ticket_attachments_draft_idx").on(t.draftId),
    index("ticket_attachments_cleanup_idx").on(t.deletedAt, t.createdAt),
    check(
      "ticket_attachments_owner_ck",
      sql`((${t.ticketId} is not null)::int + (${t.draftId} is not null)::int) = 1`,
    ),
    check("ticket_attachments_size_ck", sql`${t.size} >= 0`),
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
