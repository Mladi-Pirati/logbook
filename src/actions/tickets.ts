"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { ticketLabels } from "@/db/schema"
import { requireUser } from "@/lib/auth/session"
import {
  createTicketCore,
  moveTicketCore,
  setTicketAssigneesCore,
  updateTicketCore,
} from "@/lib/tickets"
import { syncTicketToDiscordSafely } from "@/lib/discord/notify"
import { cleanupTicketAttachmentObjects } from "@/lib/ticket-attachments"
import { richTextDocumentSchema } from "@/lib/rich-text"
import { after } from "next/server"

const createTicketInput = z.object({
  projectId: z.string().uuid(),
  projectKey: z.string(),
  columnId: z.string().uuid(),
  title: z.string().min(1).max(200),
  descriptionDocument: richTextDocumentSchema,
  draftId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  estimate: z.number().int().min(0).optional(),
  dueDate: z.string().datetime().optional(),
  priority: z.enum(["urgent", "high", "medium", "low", "none"]).default("none"),
  assigneeIds: z.array(z.string()).default([]),
  labelIds: z.array(z.string().uuid()).default([]),
})

const updateTicketInput = z.object({
  id: z.string().uuid(),
  projectKey: z.string(),
  title: z.string().min(1).max(200).optional(),
  descriptionDocument: richTextDocumentSchema.optional(),
  draftId: z.string().uuid().optional(),
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

  const { projectKey, ...input } = parsed.data
  const ticket = await createTicketCore({
    ...input,
    reporterId: user.helmUserId,
  })

  await syncTicketToDiscordSafely(ticket.id)
  revalidatePath(`/projects/${projectKey}/board`)
  revalidatePath("/(app)/tickets/[key]", "page")
  return { ok: true as const, ticket }
}

export async function updateTicket(raw: unknown) {
  const user = await requireUser()
  const parsed = updateTicketInput.safeParse(raw)
  if (!parsed.success)
    return { ok: false as const, errors: parsed.error.issues }

  const { projectKey, ...input } = parsed.data
  const ticket = await updateTicketCore({
    ...input,
    uploadedById: user.helmUserId,
  })

  await syncTicketToDiscordSafely(ticket.id)
  after(() => cleanupTicketAttachmentObjects())
  revalidatePath(`/projects/${projectKey}/board`)
  revalidatePath("/(app)/tickets/[key]", "page")
  return { ok: true as const, ticket }
}

export async function moveTicket(raw: unknown) {
  await requireUser()
  const parsed = moveTicketInput.safeParse(raw)
  if (!parsed.success)
    return { ok: false as const, errors: parsed.error.issues }

  const { ticketId, columnId, position, projectKey } = parsed.data
  await moveTicketCore({ ticketId, columnId, position })

  await syncTicketToDiscordSafely(ticketId)
  revalidatePath(`/projects/${projectKey}/board`)
  revalidatePath("/(app)/tickets/[key]", "page")
  return { ok: true as const }
}

export async function setTicketAssignees(
  ticketId: string,
  assigneeIds: string[],
  projectKey: string,
) {
  await requireUser()
  await setTicketAssigneesCore(ticketId, assigneeIds)
  await syncTicketToDiscordSafely(ticketId)
  revalidatePath(`/projects/${projectKey}/board`)
  revalidatePath("/(app)/tickets/[key]", "page")
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
  await syncTicketToDiscordSafely(ticketId)
  revalidatePath(`/projects/${projectKey}/board`)
  revalidatePath("/(app)/tickets/[key]", "page")
  return { ok: true as const }
}
