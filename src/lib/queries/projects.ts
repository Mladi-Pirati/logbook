import { cache } from "react"
import { db } from "@/db"
import { projects } from "@/db/schema"
import { asc, eq, isNull } from "drizzle-orm"

export const getProjects = cache(async () => {
  return db.query.projects.findMany({
    where: isNull(projects.archivedAt),
    with: { lead: true },
    orderBy: [asc(projects.name)],
  })
})

export const getProject = cache(async (key: string) => {
  return db.query.projects.findFirst({
    where: eq(projects.key, key),
    with: { lead: true, labels: true },
  })
})
