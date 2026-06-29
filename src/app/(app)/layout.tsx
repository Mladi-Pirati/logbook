import { requireUser } from "@/lib/auth/session"
import { getProjects } from "@/lib/queries/projects"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireUser()
  const projects = await getProjects()

  return (
    <SidebarProvider>
      <AppSidebar projects={projects} />
      <SidebarInset className="overflow-hidden">{children}</SidebarInset>
    </SidebarProvider>
  )
}
