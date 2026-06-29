"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { KanbanIcon, PlusIcon, SignOutIcon, PencilSimpleIcon } from "@phosphor-icons/react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { CreateProjectDialog } from "@/components/projects/create-project-dialog"
import { GlobalCreateDialog } from "@/components/global-create-dialog"
import { logoutAction } from "@/actions/auth"

type Project = {
  id: string
  key: string
  name: string
  color: string
  icon: string
}

export function AppSidebar({ projects }: { projects: Project[] }) {
  const pathname = usePathname()
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [createTicketOpen, setCreateTicketOpen] = useState(false)

  // Pre-select the project the user is currently viewing
  const currentProjectKey =
    pathname.match(/\/projects\/([^/]+)/)?.[1] ?? undefined

  return (
    <>
      <Sidebar>
        <SidebarHeader className="p-3 pb-2">
          <div className="flex items-center gap-2 mb-2">
            <KanbanIcon className="h-5 w-5 text-primary" weight="fill" />
            <span className="font-semibold tracking-tight">Logbook</span>
            <div className="ml-auto">
              <SidebarTrigger />
            </div>
          </div>
          <Button
            className="w-full justify-start gap-2"
            size="sm"
            onClick={() => setCreateTicketOpen(true)}
          >
            <PencilSimpleIcon className="h-4 w-4" />
            Create ticket
          </Button>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Projects</SidebarGroupLabel>
            <SidebarGroupAction
              title="New project"
              onClick={() => setCreateProjectOpen(true)}
            >
              <PlusIcon className="h-4 w-4" />
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                {projects.length === 0 && (
                  <SidebarMenuItem>
                    <span className="px-2 py-1 text-xs text-muted-foreground">
                      No projects yet
                    </span>
                  </SidebarMenuItem>
                )}
                {projects.map((project) => {
                  const href = `/projects/${project.key}/board`
                  const active = pathname.startsWith(`/projects/${project.key}`)
                  return (
                    <SidebarMenuItem key={project.id}>
                      <SidebarMenuButton
                        render={<Link href={href} />}
                        isActive={active}
                      >
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs"
                          style={{ backgroundColor: project.color + "33" }}
                        >
                          {project.icon}
                        </span>
                        <span className="truncate">{project.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground font-mono shrink-0">
                          {project.key}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-4">
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
            >
              <SignOutIcon className="h-4 w-4" />
              Sign out
            </Button>
          </form>
        </SidebarFooter>
      </Sidebar>

      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
      />

      <GlobalCreateDialog
        open={createTicketOpen}
        onOpenChange={setCreateTicketOpen}
        projects={projects}
        initialProjectKey={currentProjectKey}
      />
    </>
  )
}
