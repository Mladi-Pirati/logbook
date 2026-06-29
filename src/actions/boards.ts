"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { columns } from "@/db/schema"
import { requireUser } from "@/lib/auth/session"

const createColumnInput = z.object({
  boardId: z.string().uuid(),
  name: z.string().min(1).max(80),
  color: z.string().default("#6b7280"),
  position: z.number(),
  projectKey: z.string(),
})

const updateColumnInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80).optional(),
  color: z.string().optional(),
  wipLimit: z.number().int().positive().nullable().optional(),
  projectKey: z.string(),
})

export async function createColumn(raw: unknown) {
  await requireUser()
  const parsed = createColumnInput.safeParse(raw)
  if (!parsed.success)
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors }

  const { projectKey, ...values } = parsed.data
  const [column] = await db
    .insert(columns)
    .values({ ...values, category: "custom" })
    .returning()

  revalidatePath(`/projects/${projectKey}/board`)
  return { ok: true as const, column }
}

export async function updateColumn(raw: unknown) {
  await requireUser()
  const parsed = updateColumnInput.safeParse(raw)
  if (!parsed.success)
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors }

  const { id, projectKey, ...updates } = parsed.data
  const [column] = await db
    .update(columns)
    .set(updates)
    .where(eq(columns.id, id))
    .returning()

  revalidatePath(`/projects/${projectKey}/board`)
  return { ok: true as const, column }
}

export async function deleteColumn(id: string, projectKey: string) {
  await requireUser()
  await db.delete(columns).where(eq(columns.id, id))
  revalidatePath(`/projects/${projectKey}/board`)
  return { ok: true as const }
}

export async function reorderColumn(
  id: string,
  position: number,
  projectKey: string,
) {
  await requireUser()
  await db.update(columns).set({ position }).where(eq(columns.id, id))
  revalidatePath(`/projects/${projectKey}/board`)
  return { ok: true as const }
}
