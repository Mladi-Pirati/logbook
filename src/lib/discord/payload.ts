import { asc, eq } from "drizzle-orm"
import { db } from "@/db"
import { columns, tickets } from "@/db/schema"
import { getCanonicalTicketUrl } from "@/lib/ticket-url"

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
    },
  })
  if (!ticket) return null

  const baseUrl = (process.env.AUTH_URL ?? "").replace(/\/$/, "")

  return {
    ticket: {
      id: ticket.id,
      number: ticket.number,
      key: `${ticket.project.key}-${ticket.number}`,
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      dueDate: ticket.dueDate?.toISOString() ?? null,
      url: getCanonicalTicketUrl(
        baseUrl,
        ticket.project.key,
        ticket.number,
      ),
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
