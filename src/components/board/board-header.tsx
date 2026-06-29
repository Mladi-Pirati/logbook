"use client"

import { useState } from "react"
import { GearIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { EditProjectDialog } from "@/components/projects/edit-project-dialog"

type Project = {
  id: string
  key: string
  name: string
  description: string | null
  color: string
  icon: string
}

export function BoardHeader({ project }: { project: Project }) {
  const [editOpen, setEditOpen] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="flex h-6 w-6 items-center justify-center rounded text-sm"
            style={{ backgroundColor: project.color + "33" }}
          >
            {project.icon}
          </span>
          <span className="text-muted-foreground text-xs font-mono">
            {project.key}
          </span>
          <span className="text-muted-foreground text-xs">/</span>
          <h1 className="text-sm font-medium">{project.name}</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground"
          onClick={() => setEditOpen(true)}
        >
          <GearIcon className="h-3.5 w-3.5" />
          Settings
        </Button>
      </div>

      <EditProjectDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
      />
    </>
  )
}
