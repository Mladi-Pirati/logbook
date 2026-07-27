import { and, eq, isNull, lt, or } from "drizzle-orm"
import type { HelmMember } from "@mp/helm-sdk"

import { db } from "@/db"
import { helmDirectorySyncs, users } from "@/db/schema"
import { getHelm } from "@/lib/helm"

const SYNC_KEY = "helm-members"
const FRESH_MS = 5 * 60 * 1000
const LEASE_MS = 60 * 1000
const FAILURE_RETRY_MS = 15 * 1000

export async function syncHelmMemberDirectory(options: { force?: boolean } = {}) {
  const now = new Date()
  const staleBefore = new Date(now.getTime() - FRESH_MS)
  const leaseUntil = new Date(now.getTime() + LEASE_MS)

  await db
    .insert(helmDirectorySyncs)
    .values({ key: SYNC_KEY })
    .onConflictDoNothing()

  const claimed = await db
    .update(helmDirectorySyncs)
    .set({ leaseUntil })
    .where(
      and(
        eq(helmDirectorySyncs.key, SYNC_KEY),
        or(
          isNull(helmDirectorySyncs.leaseUntil),
          lt(helmDirectorySyncs.leaseUntil, now),
        ),
        options.force
          ? undefined
          : or(
              isNull(helmDirectorySyncs.lastCompletedAt),
              lt(helmDirectorySyncs.lastCompletedAt, staleBefore),
            ),
      ),
    )
    .returning({ key: helmDirectorySyncs.key })

  if (claimed.length === 0) return { synced: 0, skipped: true as const }

  try {
    const helm = await getHelm()
    const allMembers: HelmMember[] = []
    for await (const page of helm.user.members.paginate()) {
      allMembers.push(...page)
    }
    await db.transaction(async (tx) => {
      for (const member of allMembers) {
        await tx
          .insert(users)
          .values({
            id: member.id,
            username: member.username,
            firstName: member.firstName,
            lastName: member.lastName,
            discordUserId: member.discordUserId,
            profilePictureVersion: member.profilePicture?.version ?? null,
            profilePictureBlurhash: member.profilePicture?.blurhash ?? null,
            syncedAt: now,
          })
          .onConflictDoUpdate({
            target: users.id,
            set: {
              username: member.username,
              firstName: member.firstName,
              lastName: member.lastName,
              discordUserId: member.discordUserId,
              profilePictureVersion: member.profilePicture?.version ?? null,
              profilePictureBlurhash: member.profilePicture?.blurhash ?? null,
              syncedAt: now,
            },
          })
      }
      await tx
        .update(helmDirectorySyncs)
        .set({ lastCompletedAt: new Date(), leaseUntil: null })
        .where(eq(helmDirectorySyncs.key, SYNC_KEY))
    })
    return { synced: allMembers.length, skipped: false as const }
  } catch (error) {
    await db
      .update(helmDirectorySyncs)
      .set({ leaseUntil: new Date(Date.now() + FAILURE_RETRY_MS) })
      .where(eq(helmDirectorySyncs.key, SYNC_KEY))
    console.error("[helm-member-sync]", error)
    return { synced: 0, skipped: false as const, error: true as const }
  }
}

export async function ensureHelmMemberDirectoryFresh() {
  return syncHelmMemberDirectory()
}
