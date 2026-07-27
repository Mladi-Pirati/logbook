import { cache } from "react"
import { and, asc, eq } from "drizzle-orm"
import { db } from "@/db"
import {
  columns,
  projects,
  ticketComments,
  tickets,
  users,
} from "@/db/schema"
import { ensureHelmMemberDirectoryFresh } from "@/lib/sync-members"

export const getTicketPageDataById = cache(async (ticketId: string) => {
  await ensureHelmMemberDirectoryFresh()
  const [ticket, allUsers] = await Promise.all([
    db.query.tickets.findFirst({
      where: eq(tickets.id, ticketId),
      with: {
        project: {
          with: {
            labels: true,
            board: {
              with: {
                columns: {
                  orderBy: [asc(columns.position)],
                },
              },
            },
          },
        },
        column: true,
        reporter: true,
        assignees: { with: { user: true } },
        ticketLabels: { with: { label: true } },
        comments: {
          orderBy: [asc(ticketComments.createdAt)],
          with: { author: true },
        },
      },
    }),
    db.select().from(users).orderBy(asc(users.firstName), asc(users.lastName)),
  ])

  if (!ticket) return null
  return { ticket, users: allUsers }
})

export const getTicketPageDataByKey = cache(
  async (projectKey: string, ticketNumber: number) => {
    const [match] = await db
      .select({ id: tickets.id })
      .from(tickets)
      .innerJoin(projects, eq(tickets.projectId, projects.id))
      .where(
        and(eq(projects.key, projectKey), eq(tickets.number, ticketNumber)),
      )
      .limit(1)

    return match ? getTicketPageDataById(match.id) : null
  },
)
