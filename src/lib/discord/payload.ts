import { asc, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import { columns, tickets, users } from "@/db/schema"
import { getCanonicalTicketUrl } from "@/lib/ticket-url"
import {
  getRichTextMentionIds,
  richTextToDiscordMarkdown,
} from "@/lib/rich-text"

type ColumnInfo = {
  id: string
  name: string
  category: string
  color: string
}

type UserInfo = {
  id: string
  name: string
}

export type TicketDiscordPayload = {
  ticket: {
    id: string
    number: number
    key: string
    title: string
    description: string | null
    priority: "urgent" | "high" | "medium" | "low" | "none"
    dueDate: string | null
    url: string
    reporter: UserInfo
    assignees: UserInfo[]
    labels: { name: string; color: string }[]
  }
  project: {
    id: string
    key: string
    name: string
    icon: string
  }
  column: ColumnInfo
  columns: ColumnInfo[]
}

function userInfo(user: {
  id: string
  firstName: string
  lastName: string
}): UserInfo {
  return { id: user.id, name: `${user.firstName} ${user.lastName}` }
}

function columnInfo(column: {
  id: string
  name: string
  category: string
  color: string
}): ColumnInfo {
  return {
    id: column.id,
    name: column.name,
    category: column.category,
    color: column.color,
  }
}

export async function getTicketDiscordPayload(
  ticketId: string,
): Promise<TicketDiscordPayload | null> {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    with: {
      project: {
        with: {
          board: {
            with: { columns: { orderBy: [asc(columns.position)] } },
          },
        },
      },
      column: true,
      reporter: true,
      assignees: { with: { user: true } },
      ticketLabels: { with: { label: true } },
      attachments: true,
    },
  })
  if (!ticket) return null

  const baseUrl = (process.env.AUTH_URL ?? "").replace(/\/$/, "")
  const mentionIds = getRichTextMentionIds(ticket.descriptionDocument)
  const mentionedUsers =
    mentionIds.length > 0
      ? await db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(inArray(users.id, mentionIds))
      : []
  const mentionNames = new Map(
    mentionedUsers.map((user) => [
      user.id,
      `${user.firstName} ${user.lastName}`,
    ]),
  )

  return {
    ticket: {
      id: ticket.id,
      number: ticket.number,
      key: `${ticket.project.key}-${ticket.number}`,
      title: ticket.title,
      description: richTextToDiscordMarkdown(ticket.descriptionDocument, {
        baseUrl,
        attachments: new Map(
          ticket.attachments
            .filter((attachment) => attachment.deletedAt === null)
            .map((attachment) => [
              attachment.id,
              { fileName: attachment.fileName },
            ]),
        ),
        mentions: mentionNames,
      }),
      priority: ticket.priority,
      dueDate: ticket.dueDate?.toISOString() ?? null,
      url: getCanonicalTicketUrl(baseUrl, ticket.project.key, ticket.number),
      reporter: userInfo(ticket.reporter),
      assignees: ticket.assignees.map((a) => userInfo(a.user)),
      labels: ticket.ticketLabels.map((tl) => ({
        name: tl.label.name,
        color: tl.label.color,
      })),
    },
    project: {
      id: ticket.project.id,
      key: ticket.project.key,
      name: ticket.project.name,
      icon: ticket.project.icon,
    },
    column: columnInfo(ticket.column),
    columns: (ticket.project.board?.columns ?? []).map(columnInfo),
  }
}
