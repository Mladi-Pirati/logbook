import "server-only"

import { inArray } from "drizzle-orm"
import { db } from "@/db"
import { users } from "@/db/schema"
import { getRichTextMentionIds, type RichTextDocument } from "@/lib/rich-text"

type Db = typeof db
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]

export async function resolveRichTextMentionNames(
  executor: Db | Tx,
  document: RichTextDocument,
) {
  const mentionIds = getRichTextMentionIds(document)
  if (mentionIds.length === 0) return new Map<string, string>()

  const mentionedUsers = await executor
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(inArray(users.id, mentionIds))

  if (mentionedUsers.length !== mentionIds.length) {
    throw new Error("Invalid user mention")
  }

  return new Map(
    mentionedUsers.map((user) => [
      user.id,
      `${user.firstName} ${user.lastName}`,
    ]),
  )
}
