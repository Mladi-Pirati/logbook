"use server"

import { db } from "@/db"
import { columns, projects, users } from "@/db/schema"
import { eq, asc } from "drizzle-orm"
import { requireUser } from "@/lib/auth/session"

export async function fetchProjectColumns(projectKey: string) {
  await requireUser()

  const project = await db.query.projects.findFirst({
    where: eq(projects.key, projectKey),
    with: {
      board: {
        with: {
          columns: { orderBy: [asc(columns.position)] },
        },
      },
    },
  })

  return project?.board?.columns ?? []
}

export async function fetchAllUsers() {
  await requireUser()
  return db.select().from(users).orderBy(asc(users.firstName))
}
