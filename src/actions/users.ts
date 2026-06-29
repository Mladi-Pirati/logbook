"use server"

import { getHelm } from "@/lib/helm"
import { upsertUser } from "@/lib/sync-user"
import { requireUser } from "@/lib/auth/session"

export async function syncAllMembers() {
  await requireUser()
  const helm = await getHelm()

  let synced = 0
  for await (const page of helm.user.members.paginate()) {
    for (const member of page) {
      await upsertUser(member)
      synced++
    }
  }
  return { ok: true as const, synced }
}
