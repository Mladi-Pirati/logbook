"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { projects, tickets, ticketAssignees, ticketLabels } from "@/db/schema"
import { requireUser } from "@/lib/auth/session"

const createTicketInput = z.object({
  projectId: z.string().uuid(),
  projectKey: z.string(),
  columnId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  parentId: z.string().uuid().optional(),
  estimate: z.number().int().min(0).optional(),
  dueDate: z.string().datetime().optional(),
  priority: z
    .enum(["urgent", "high", "medium", "low", "none"])
    .default("none"),
  assigneeIds: z.array(z.string()).default([]),
  labelIds: z.array(z.string().uuid()).default([]),
})

const updateTicketInput = z.object({
  id: z.string().uuid(),
  projectKey: z.string(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  columnId: z.string().uuid().optional(),
  parentId: z.string().uuid().nullable().optional(),
  estimate: z.number().int().min(0).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional(),
  completedAt: z.string().datetime().nullable().optional(),
})

const moveTicketInput = z.object({
  ticketId: z.string().uuid(),
  columnId: z.string().uuid(),
  position: z.number(),
  projectKey: z.string(),
})

export async function createTicket(raw: unknown) {
  const user = await requireUser()
  const parsed = createTicketInput.safeParse(raw)
  if (!parsed.success)
    return { ok: false as const, errors: parsed.error.issues }

  const {
    projectId,
    projectKey,
    columnId,
    title,
    description,
    parentId,
    estimate,
    dueDate,
    priority,
    assigneeIds,
    labelIds,
  } = parsed.data

  const ticket = await db.transaction(async (tx) => {
    const [proj] = await tx
      .update(projects)
      .set({ nextTicketNumber: sql`${projects.nextTicketNumber} + 1` })
      .where(eq(projects.id, projectId))
      .returning({ nextTicketNumber: projects.nextTicketNumber })

    const number = proj.nextTicketNumber - 1

    const maxPositionResult = await tx
      .select({ pos: sql<number>`coalesce(max(position), 0)` })
      .from(tickets)
      .where(eq(tickets.columnId, columnId))
    const position = (maxPositionResult[0]?.pos ?? 0) + 1024

    const [ticket] = await tx
      .insert(tickets)
      .values({
        projectId,
        number,
        title,
        description,
        columnId,
        parentId,
        reporterId: user.helmUserId,
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

  revalidatePath(`/projects/${projectKey}/board`)
  return { ok: true as const, ticket }
}

export async function updateTicket(raw: unknown) {
  await requireUser()
  const parsed = updateTicketInput.safeParse(raw)
  if (!parsed.success)
    return { ok: false as const, errors: parsed.error.issues }

  const { id, projectKey, dueDate, completedAt, ...rest } = parsed.data

  const [ticket] = await db
    .update(tickets)
    .set({
      ...rest,
      dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
      completedAt: completedAt !== undefined ? (completedAt ? new Date(completedAt) : null) : undefined,
    })
    .where(eq(tickets.id, id))
    .returning()

  revalidatePath(`/projects/${projectKey}/board`)
  return { ok: true as const, ticket }
}

export async function moveTicket(raw: unknown) {
  await requireUser()
  const parsed = moveTicketInput.safeParse(raw)
  if (!parsed.success)
    return { ok: false as const, errors: parsed.error.issues }

  const { ticketId, columnId, position, projectKey } = parsed.data

  await db
    .update(tickets)
    .set({ columnId, position })
    .where(eq(tickets.id, ticketId))

  revalidatePath(`/projects/${projectKey}/board`)
  return { ok: true as const }
}

export async function setTicketAssignees(
  ticketId: string,
  assigneeIds: string[],
  projectKey: string,
) {
  await requireUser()
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
  revalidatePath(`/projects/${projectKey}/board`)
  return { ok: true as const }
}

export async function setTicketLabels(
  ticketId: string,
  labelIds: string[],
  projectKey: string,
) {
  await requireUser()
  await db.transaction(async (tx) => {
    await tx.delete(ticketLabels).where(eq(ticketLabels.ticketId, ticketId))
    if (labelIds.length > 0) {
      await tx
        .insert(ticketLabels)
        .values(labelIds.map((labelId) => ({ ticketId, labelId })))
    }
  })
  revalidatePath(`/projects/${projectKey}/board`)
  return { ok: true as const }
}
