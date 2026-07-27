import { and, eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { projects, tickets, ticketAssignees, ticketLabels } from "@/db/schema"

type Db = typeof db
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]

export type TicketPriority = "urgent" | "high" | "medium" | "low" | "none"

export type CreateTicketCoreInput = {
  projectId: string
  columnId: string
  title: string
  description?: string
  parentId?: string
  reporterId: string
  estimate?: number
  dueDate?: string
  priority: TicketPriority
  assigneeIds: string[]
  labelIds: string[]
}

export type UpdateTicketCoreInput = {
  id: string
  title?: string
  description?: string | null
  columnId?: string
  parentId?: string | null
  estimate?: number | null
  dueDate?: string | null
  priority?: TicketPriority
  completedAt?: string | null
}

async function nextColumnPosition(executor: Db | Tx, columnId: string) {
  const maxPositionResult = await executor
    .select({ pos: sql<number>`coalesce(max(position), 0)` })
    .from(tickets)
    .where(eq(tickets.columnId, columnId))
  return (maxPositionResult[0]?.pos ?? 0) + 1024
}

export async function createTicketCore(input: CreateTicketCoreInput) {
  const {
    projectId,
    columnId,
    title,
    description,
    parentId,
    reporterId,
    estimate,
    dueDate,
    priority,
    assigneeIds,
    labelIds,
  } = input

  return db.transaction(async (tx) => {
    const [proj] = await tx
      .update(projects)
      .set({ nextTicketNumber: sql`${projects.nextTicketNumber} + 1` })
      .where(eq(projects.id, projectId))
      .returning({ nextTicketNumber: projects.nextTicketNumber })

    const number = proj.nextTicketNumber - 1
    const position = await nextColumnPosition(tx, columnId)

    const [ticket] = await tx
      .insert(tickets)
      .values({
        projectId,
        number,
        title,
        description,
        columnId,
        parentId,
        reporterId,
        estimate,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        priority,
        position,
      })
      .returning()

    if (assigneeIds.length > 0) {
      await tx.insert(ticketAssignees).values(
        assigneeIds.map((userId) => ({ ticketId: ticket.id, userId })),
      )
    }

    if (labelIds.length > 0) {
      await tx.insert(ticketLabels).values(
        labelIds.map((labelId) => ({ ticketId: ticket.id, labelId })),
      )
    }

    return ticket
  })
}

export async function updateTicketCore(input: UpdateTicketCoreInput) {
  const { id, dueDate, completedAt, ...rest } = input

  const [ticket] = await db
    .update(tickets)
    .set({
      ...rest,
      dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
      completedAt: completedAt !== undefined ? (completedAt ? new Date(completedAt) : null) : undefined,
    })
    .where(eq(tickets.id, id))
    .returning()

  return ticket
}

export async function moveTicketCore(input: {
  ticketId: string
  columnId: string
  position?: number
}) {
  const { ticketId, columnId } = input
  const position = input.position ?? (await nextColumnPosition(db, columnId))

  await db
    .update(tickets)
    .set({ columnId, position })
    .where(eq(tickets.id, ticketId))
}

export async function setTicketAssigneesCore(
  ticketId: string,
  assigneeIds: string[],
) {
  await db.transaction(async (tx) => {
    await tx
      .delete(ticketAssignees)
      .where(eq(ticketAssignees.ticketId, ticketId))
    if (assigneeIds.length > 0) {
      await tx
        .insert(ticketAssignees)
        .values(assigneeIds.map((userId) => ({ ticketId, userId })))
    }
  })
}

export async function toggleTicketAssignee(ticketId: string, userId: string) {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ userId: ticketAssignees.userId })
      .from(ticketAssignees)
      .where(
        and(
          eq(ticketAssignees.ticketId, ticketId),
          eq(ticketAssignees.userId, userId),
        ),
      )

    if (existing.length > 0) {
      await tx
        .delete(ticketAssignees)
        .where(
          and(
            eq(ticketAssignees.ticketId, ticketId),
            eq(ticketAssignees.userId, userId),
          ),
        )
      return { assigned: false as const }
    }

    await tx.insert(ticketAssignees).values({ ticketId, userId })
    return { assigned: true as const }
  })
}
