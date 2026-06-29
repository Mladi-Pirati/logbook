import Link from "next/link"
import { getProjects } from "@/lib/queries/projects"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"

export default async function ProjectsPage() {
  const projects = await getProjects()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Projects</h1>
      {projects.length === 0 ? (
        <p className="text-muted-foreground">
          No projects yet. Create one from the sidebar.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.key}/board`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl"
                        style={{ backgroundColor: project.color + "33" }}
                      >
                        {project.icon}
                      </span>
                      <CardTitle className="text-base">{project.name}</CardTitle>
                    </div>
                    <Badge variant="secondary" className="shrink-0 font-mono text-xs">
                      {project.key}
                    </Badge>
                  </div>
                  {project.description && (
                    <CardDescription className="line-clamp-2">
                      {project.description}
                    </CardDescription>
                  )}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
