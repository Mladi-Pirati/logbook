import { NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { db } from "@/db"
import { columns, projects } from "@/db/schema"
import { verifyIntegrationAuth } from "@/lib/discord/api"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const unauthorized = verifyIntegrationAuth(request)
  if (unauthorized) return unauthorized

  const { key } = await params

  const project = await db.query.projects.findFirst({
    where: eq(projects.key, key),
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

  const projectColumns = (project.board?.columns ?? []).map((col) => ({
    id: col.id,
    name: col.name,
    category: col.category,
    color: col.color,
  }))

  return NextResponse.json({
    ok: true,
    project: {
      id: project.id,
      key: project.key,
      name: project.name,
      icon: project.icon,
    },
    columns: projectColumns,
  })
}
