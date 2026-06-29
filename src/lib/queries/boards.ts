import { cache } from "react"
import { db } from "@/db"
import { columns, projects, tickets, users } from "@/db/schema"
import { asc, eq } from "drizzle-orm"

export const getBoardForProject = cache(async (projectKey: string) => {
  const project = await db.query.projects.findFirst({
    where: eq(projects.key, projectKey),
    with: {
      board: {
        with: {
          columns: {
            orderBy: [asc(columns.position)],
            with: {
              tickets: {
                orderBy: [asc(tickets.position)],
                with: {
                  assignees: { with: { user: true } },
                  ticketLabels: { with: { label: true } },
                  reporter: true,
                },
              },
            },
          },
        },
      },
    },
  })
  return project ?? null
})

export const getUsers = cache(async () => {
  return db.select().from(users).orderBy(asc(users.firstName))
})
