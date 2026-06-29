"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { boards, columns, projects } from "@/db/schema"
import { requireUser } from "@/lib/auth/session"

const createProjectInput = z.object({
  key: z
    .string()
    .min(1)
    .max(10)
    .regex(/^[A-Z][A-Z0-9]{0,9}$/, "Key must be uppercase letters and digits"),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  leadUserId: z.string().optional(),
  color: z.string().default("#6366f1"),
  icon: z.string().default("📋"),
})

const updateProjectInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  leadUserId: z.string().nullable().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
})

const DEFAULT_COLUMNS = [
  { name: "Backlog", category: "backlog" as const, position: 1024, color: "#6b7280" },
  { name: "In Progress", category: "in_progress" as const, position: 2048, color: "#3b82f6" },
  { name: "Testing", category: "testing" as const, position: 3072, color: "#f59e0b" },
  { name: "Pending", category: "pending" as const, position: 4096, color: "#8b5cf6" },
  { name: "Done", category: "done" as const, position: 5120, color: "#10b981" },
  { name: "Rejected", category: "rejected" as const, position: 6144, color: "#ef4444" },
]

export async function createProject(raw: unknown) {
  await requireUser()
  const parsed = createProjectInput.safeParse(raw)
  if (!parsed.success)
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors }

  const { key, name, description, leadUserId, color, icon } = parsed.data

  const project = await db.transaction(async (tx) => {
    const [proj] = await tx
      .insert(projects)
      .values({ key, name, description, leadUserId, color, icon })
      .returning()

    const [board] = await tx
      .insert(boards)
      .values({ projectId: proj.id, name: `${name} Board` })
      .returning()

    await tx.insert(columns).values(
      DEFAULT_COLUMNS.map((col) => ({ ...col, boardId: board.id })),
    )

    return proj
  })

  revalidatePath("/projects")
  return { ok: true as const, project }
}

export async function updateProject(raw: unknown) {
  await requireUser()
  const parsed = updateProjectInput.safeParse(raw)
  if (!parsed.success)
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors }

  const { id, ...updates } = parsed.data
  const [project] = await db
    .update(projects)
    .set(updates)
    .where(eq(projects.id, id))
    .returning()

  revalidatePath("/projects")
  revalidatePath(`/projects/${project.key}/board`)
  return { ok: true as const, project }
}

export async function deleteProject(id: string) {
  await requireUser()
  const [project] = await db
    .delete(projects)
    .where(eq(projects.id, id))
    .returning()

  revalidatePath("/projects")
  return { ok: true as const, project }
}

export async function archiveProject(id: string) {
  await requireUser()
  const [project] = await db
    .update(projects)
    .set({ archivedAt: new Date() })
    .where(eq(projects.id, id))
    .returning()

  revalidatePath("/projects")
  return { ok: true as const, project }
}
