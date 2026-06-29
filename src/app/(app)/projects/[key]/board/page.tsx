import { notFound } from "next/navigation"
import { getBoardForProject, getUsers } from "@/lib/queries/boards"
import { Board } from "@/components/board/board"
import { BoardHeader } from "@/components/board/board-header"

export const dynamic = "force-dynamic"

export default async function BoardPage({
  params,
}: {
  params: Promise<{ key: string }>
}) {
  const { key } = await params
  const [project, users] = await Promise.all([
    getBoardForProject(key),
    getUsers(),
  ])

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
        users={users}
      />
    </div>
  )
}
