import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm"
import { db } from "@/db"
import {
  projects,
  tickets,
  ticketAssignees,
  ticketAttachments,
  ticketLabels,
} from "@/db/schema"
import {
  getRichTextAttachmentIds,
  type RichTextDocument,
  richTextToPlainText,
} from "@/lib/rich-text"
import { resolveRichTextMentionNames } from "@/lib/rich-text-server"

type Db = typeof db
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]

export type TicketPriority = "urgent" | "high" | "medium" | "low" | "none"

export type CreateTicketCoreInput = {
  projectId: string
  columnId: string
  title: string
  descriptionDocument: RichTextDocument
  draftId?: string
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
  descriptionDocument?: RichTextDocument
  draftId?: string
  uploadedById?: string
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
    descriptionDocument,
    draftId,
    parentId,
    reporterId,
    estimate,
    dueDate,
    priority,
    assigneeIds,
    labelIds,
  } = input
  const attachmentIds = getRichTextAttachmentIds(descriptionDocument)

  return db.transaction(async (tx) => {
    const mentionNames = await resolveRichTextMentionNames(
      tx,
      descriptionDocument,
    )

    if (attachmentIds.length > 0) {
      if (!draftId) throw new Error("Attachment draft is required")
      const attachments = await tx
        .select({
          id: ticketAttachments.id,
          draftId: ticketAttachments.draftId,
          uploadedById: ticketAttachments.uploadedById,
          deletedAt: ticketAttachments.deletedAt,
        })
        .from(ticketAttachments)
        .where(inArray(ticketAttachments.id, attachmentIds))
      if (
        attachments.length !== attachmentIds.length ||
        attachments.some(
          (attachment) =>
            attachment.draftId !== draftId ||
            attachment.uploadedById !== reporterId ||
            attachment.deletedAt !== null,
        )
      ) {
        throw new Error("Invalid ticket attachment reference")
      }
    }

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
        description: richTextToPlainText(descriptionDocument, {
          mentions: mentionNames,
        }),
        descriptionDocument,
        columnId,
        parentId,
        reporterId,
        estimate,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        priority,
        position,
      })
      .returning()

    if (attachmentIds.length > 0) {
      await tx
        .update(ticketAttachments)
        .set({
          ticketId: ticket.id,
          draftId: null,
          claimedAt: new Date(),
        })
        .where(inArray(ticketAttachments.id, attachmentIds))
    }

    if (assigneeIds.length > 0) {
      await tx
        .insert(ticketAssignees)
        .values(assigneeIds.map((userId) => ({ ticketId: ticket.id, userId })))
    }

    if (labelIds.length > 0) {
      await tx
        .insert(ticketLabels)
        .values(labelIds.map((labelId) => ({ ticketId: ticket.id, labelId })))
    }

    return ticket
  })
}

export async function updateTicketCore(input: UpdateTicketCoreInput) {
  const {
    id,
    dueDate,
    completedAt,
    descriptionDocument,
    draftId,
    uploadedById,
    ...rest
  } = input
  const attachmentIds = descriptionDocument
    ? getRichTextAttachmentIds(descriptionDocument)
    : undefined

  return db.transaction(async (tx) => {
    const mentionNames = descriptionDocument
      ? await resolveRichTextMentionNames(tx, descriptionDocument)
      : undefined

    if (attachmentIds) {
      const referenced =
        attachmentIds.length > 0
          ? await tx
              .select({
                id: ticketAttachments.id,
                ticketId: ticketAttachments.ticketId,
                draftId: ticketAttachments.draftId,
                uploadedById: ticketAttachments.uploadedById,
                deletedAt: ticketAttachments.deletedAt,
              })
              .from(ticketAttachments)
              .where(inArray(ticketAttachments.id, attachmentIds))
          : []

      if (
        referenced.length !== attachmentIds.length ||
        referenced.some((attachment) => {
          if (attachment.deletedAt) return true
          if (attachment.ticketId === id) return false
          return (
            !draftId ||
            !uploadedById ||
            attachment.ticketId !== null ||
            attachment.draftId !== draftId ||
            attachment.uploadedById !== uploadedById
          )
        })
      ) {
        throw new Error("Invalid ticket attachment reference")
      }

      const draftAttachmentIds = referenced
        .filter((attachment) => attachment.ticketId === null)
        .map((attachment) => attachment.id)
      if (draftAttachmentIds.length > 0) {
        await tx
          .update(ticketAttachments)
          .set({ ticketId: id, draftId: null, claimedAt: new Date() })
          .where(inArray(ticketAttachments.id, draftAttachmentIds))
      }

      const removalWhere =
        attachmentIds.length > 0
          ? and(
              eq(ticketAttachments.ticketId, id),
              isNull(ticketAttachments.deletedAt),
              notInArray(ticketAttachments.id, attachmentIds),
            )
          : and(
              eq(ticketAttachments.ticketId, id),
              isNull(ticketAttachments.deletedAt),
            )
      await tx
        .update(ticketAttachments)
        .set({ deletedAt: new Date() })
        .where(removalWhere)
    }

    const [ticket] = await tx
      .update(tickets)
      .set({
        ...rest,
        description:
          descriptionDocument !== undefined
            ? richTextToPlainText(descriptionDocument, {
                mentions: mentionNames,
              })
            : undefined,
        descriptionDocument,
        dueDate:
          dueDate !== undefined
            ? dueDate
              ? new Date(dueDate)
              : null
            : undefined,
        completedAt:
          completedAt !== undefined
            ? completedAt
              ? new Date(completedAt)
              : null
            : undefined,
      })
      .where(eq(tickets.id, id))
      .returning()

    return ticket
  })
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
