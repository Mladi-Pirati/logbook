"use server"

import { requireUser } from "@/lib/auth/session"
import { syncHelmMemberDirectory } from "@/lib/sync-members"

export async function syncAllMembers() {
  await requireUser()
  const result = await syncHelmMemberDirectory({ force: true })
  return { ok: !("error" in result), synced: result.synced }
}
