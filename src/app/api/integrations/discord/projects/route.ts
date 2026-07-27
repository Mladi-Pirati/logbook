import { NextResponse } from "next/server"
import { asc, isNull } from "drizzle-orm"
import { db } from "@/db"
import { projects } from "@/db/schema"
import { verifyIntegrationAuth } from "@/lib/discord/api"

export async function GET(request: Request) {
  const unauthorized = verifyIntegrationAuth(request)
  if (unauthorized) return unauthorized

  const allProjects = await db
    .select({ id: projects.id, key: projects.key, name: projects.name, icon: projects.icon })
    .from(projects)
    .where(isNull(projects.archivedAt))
    .orderBy(asc(projects.name))

  return NextResponse.json({ ok: true, projects: allProjects })
}
