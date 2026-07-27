import { requireUser } from "@/lib/auth/session"
import { getProjects } from "@/lib/queries/projects"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const currentUser = await requireUser()
  const projects = await getProjects()
  const member = await db.query.users.findFirst({
    where: eq(users.id, currentUser.helmUserId),
  })

  return (
    <SidebarProvider>
      <AppSidebar projects={projects} member={member ?? null} />
      <SidebarInset className="overflow-hidden">{children}</SidebarInset>
    </SidebarProvider>
  )
}
