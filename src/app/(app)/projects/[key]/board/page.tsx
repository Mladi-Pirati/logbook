import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getBoardForProject } from "@/lib/queries/boards"
import { Board } from "@/components/board/board"
import { BoardHeader } from "@/components/board/board-header"

export const dynamic = "force-dynamic"

type BoardPageProps = {
  params: Promise<{ key: string }>
}

export async function generateMetadata({
  params,
}: BoardPageProps): Promise<Metadata> {
  const { key } = await params
  const project = await getBoardForProject(key)

  if (!project?.board) {
    return { title: "Project not found" }
  }

  return {
    title: `${project.key} Board`,
    description: `${project.name} project board in Logbook.`,
    alternates: {
      canonical: `/projects/${project.key}/board`,
    },
  }
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { key } = await params
  const project = await getBoardForProject(key)

  if (!project?.board) notFound()

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <BoardHeader
        project={{
          id: project.id,
          key: project.key,
          name: project.name,
          description: project.description,
          color: project.color,
          icon: project.icon,
        }}
      />
      <Board
        project={{ id: project.id, key: project.key, name: project.name }}
        board={project.board}
      />
    </div>
  )
}
