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
