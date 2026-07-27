import { NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/db"
import { columns, projects } from "@/db/schema"
import { verifyIntegrationAuth, resolveDiscordUser, userNotLinkedResponse, validateAssigneeIds } from "@/lib/discord/api"
import { createTicketCore } from "@/lib/tickets"
import { syncTicketToDiscordSafely } from "@/lib/discord/notify"
import { getTicketDiscordPayload } from "@/lib/discord/payload"

const createTicketSchema = z.object({
  projectKey: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: z.enum(["urgent", "high", "medium", "low", "none"]).default("none"),
  columnId: z.string().uuid().optional(),
  assigneeIds: z.array(z.string()).default([]),
  discordUserId: z.string(),
})

export async function POST(request: Request) {
  const unauthorized = verifyIntegrationAuth(request)
  if (unauthorized) return unauthorized

  const body = await request.json().catch(() => null)
  const parsed = createTicketSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errors: parsed.error.issues },
      { status: 400 },
    )
  }

  const { projectKey, title, description, priority, columnId, assigneeIds, discordUserId } = parsed.data

  const user = await resolveDiscordUser(discordUserId)
  if (!user) return userNotLinkedResponse()

  const validated = await validateAssigneeIds(assigneeIds)
  if (!validated.ok) return validated.response

  const project = await db.query.projects.findFirst({
    where: eq(projects.key, projectKey),
    with: {
      board: {
        with: {
          columns: {
            orderBy: [asc(columns.position)],
          },
        },
      },
    },
  })

  if (!project) {
    return NextResponse.json(
      { ok: false, error: "project_not_found" },
      { status: 404 },
    )
  }

  const boardColumns = project.board?.columns ?? []

  let targetColumnId: string
  if (columnId) {
    if (!boardColumns.some((col) => col.id === columnId)) {
      return NextResponse.json(
        { ok: false, error: "invalid_column" },
        { status: 400 },
      )
    }
    targetColumnId = columnId
  } else {
    if (boardColumns.length === 0) {
      return NextResponse.json(
        { ok: false, error: "no_columns" },
        { status: 422 },
      )
    }
    targetColumnId = boardColumns[0].id
  }

  const ticket = await createTicketCore({
    projectId: project.id,
    columnId: targetColumnId,
    title,
    description,
    priority,
    reporterId: user.id,
    assigneeIds: validated.assigneeIds,
    labelIds: [],
  })

  await syncTicketToDiscordSafely(ticket.id)
  revalidatePath(`/projects/${projectKey}/board`)

  const payload = await getTicketDiscordPayload(ticket.id)

  return NextResponse.json(
    { ok: true, ...payload },
    { status: 201 },
  )
}
