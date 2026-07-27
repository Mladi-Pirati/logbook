import { pgEnum } from "drizzle-orm/pg-core"

export const columnCategory = pgEnum("column_category", [
  "backlog",
  "in_progress",
  "testing",
  "pending",
  "done",
  "rejected",
  "custom",
])

export const ticketPriority = pgEnum("ticket_priority", [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
])

export const ticketCommentSource = pgEnum("ticket_comment_source", [
  "logbook",
  "discord",
])

export const ticketCommentSyncStatus = pgEnum("ticket_comment_sync_status", [
  "pending",
  "synced",
  "failed",
])

export const ticketCommentSyncOperation = pgEnum(
  "ticket_comment_sync_operation",
  ["create", "update", "delete"],
)
