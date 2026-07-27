import { relations } from "drizzle-orm"
import { users } from "./users"
import { projects, labels } from "./projects"
import { boards, columns } from "./boards"
import {
  tickets,
  ticketAssignees,
  ticketAttachments,
  ticketLabels,
} from "./tickets"
import { ticketDiscordMessages } from "./discord"
import { ticketComments } from "./comments"

export const usersRelations = relations(users, ({ many }) => ({
  ledProjects: many(projects),
  assignedTickets: many(ticketAssignees),
  reportedTickets: many(tickets),
  ticketComments: many(ticketComments),
  uploadedTicketAttachments: many(ticketAttachments),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  lead: one(users, { fields: [projects.leadUserId], references: [users.id] }),
  board: one(boards),
  tickets: many(tickets),
  labels: many(labels),
}))

export const labelsRelations = relations(labels, ({ one, many }) => ({
  project: one(projects, {
    fields: [labels.projectId],
    references: [projects.id],
  }),
  ticketLabels: many(ticketLabels),
}))

export const boardsRelations = relations(boards, ({ one, many }) => ({
  project: one(projects, {
    fields: [boards.projectId],
    references: [projects.id],
  }),
  columns: many(columns),
}))

export const columnsRelations = relations(columns, ({ one, many }) => ({
  board: one(boards, { fields: [columns.boardId], references: [boards.id] }),
  tickets: many(tickets),
}))

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  project: one(projects, {
    fields: [tickets.projectId],
    references: [projects.id],
  }),
  column: one(columns, {
    fields: [tickets.columnId],
    references: [columns.id],
  }),
  parent: one(tickets, {
    fields: [tickets.parentId],
    references: [tickets.id],
    relationName: "parentChild",
  }),
  children: many(tickets, { relationName: "parentChild" }),
  reporter: one(users, {
    fields: [tickets.reporterId],
    references: [users.id],
  }),
  assignees: many(ticketAssignees),
  ticketLabels: many(ticketLabels),
  discordMessage: one(ticketDiscordMessages),
  comments: many(ticketComments),
  attachments: many(ticketAttachments),
}))

export const ticketAttachmentsRelations = relations(
  ticketAttachments,
  ({ one }) => ({
    ticket: one(tickets, {
      fields: [ticketAttachments.ticketId],
      references: [tickets.id],
    }),
    uploadedBy: one(users, {
      fields: [ticketAttachments.uploadedById],
      references: [users.id],
    }),
  }),
)

export const ticketDiscordMessagesRelations = relations(
  ticketDiscordMessages,
  ({ one }) => ({
    ticket: one(tickets, {
      fields: [ticketDiscordMessages.ticketId],
      references: [tickets.id],
    }),
  }),
)

export const ticketCommentsRelations = relations(ticketComments, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketComments.ticketId],
    references: [tickets.id],
  }),
  author: one(users, {
    fields: [ticketComments.authorUserId],
    references: [users.id],
  }),
}))

export const ticketAssigneesRelations = relations(
  ticketAssignees,
  ({ one }) => ({
    ticket: one(tickets, {
      fields: [ticketAssignees.ticketId],
      references: [tickets.id],
    }),
    user: one(users, {
      fields: [ticketAssignees.userId],
      references: [users.id],
    }),
  }),
)

export const ticketLabelsRelations = relations(ticketLabels, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketLabels.ticketId],
    references: [tickets.id],
  }),
  label: one(labels, {
    fields: [ticketLabels.labelId],
    references: [labels.id],
  }),
}))
