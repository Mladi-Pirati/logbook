import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { z } from "zod"
import {
  TicketDetail,
  type TicketCommentView,
} from "@/components/tickets/ticket-detail"
import type { Column, Label, Ticket, User } from "@/components/board/types"
import { requireUser } from "@/lib/auth/session"
import {
  getTicketPageDataById,
  getTicketPageDataByKey,
} from "@/lib/queries/tickets"
import { getCommentAuthorPresentation } from "@/lib/comments/presentation"
import { getTicketPath, parseTicketKey } from "@/lib/ticket-url"

export const dynamic = "force-dynamic"

const legacyTicketIdSchema = z.string().uuid()

type TicketPageProps = {
  params: Promise<{ key: string }>
}

async function getTicketMetadata(key: string): Promise<Metadata> {
  let data
  if (legacyTicketIdSchema.safeParse(key).success) {
    data = await getTicketPageDataById(key)
  } else {
    const parsedKey = parseTicketKey(key)
    data = parsedKey
      ? await getTicketPageDataByKey(parsedKey.projectKey, parsedKey.number)
      : null
  }

  if (!data) {
    return { title: "Ticket not found" }
  }

  const { ticket } = data
  const ticketKey = `${ticket.project.key}-${ticket.number}`
  const canonicalPath = getTicketPath(ticket.project.key, ticket.number)

  return {
    title: `${ticketKey}: ${ticket.title}`,
    description: `View and discuss ${ticketKey} in Logbook.`,
    alternates: {
      canonical: canonicalPath,
    },
  }
}

export async function generateMetadata({
  params,
}: TicketPageProps): Promise<Metadata> {
  const { key } = await params
  return getTicketMetadata(key)
}

export default async function TicketPage({ params }: TicketPageProps) {
  const [{ key }, currentUser] = await Promise.all([params, requireUser()])

  if (legacyTicketIdSchema.safeParse(key).success) {
    const legacyData = await getTicketPageDataById(key)
    if (!legacyData) notFound()
    redirect(
      getTicketPath(legacyData.ticket.project.key, legacyData.ticket.number),
    )
  }

  const parsedKey = parseTicketKey(key)
  if (!parsedKey) notFound()
  const data = await getTicketPageDataByKey(
    parsedKey.projectKey,
    parsedKey.number,
  )
  if (!data) notFound()

  const { ticket } = data
  const canonicalPath = getTicketPath(ticket.project.key, ticket.number)
  if (`/tickets/${key}` !== canonicalPath) redirect(canonicalPath)
  const boardColumns = ticket.project.board?.columns ?? []
  const columns: Column[] = boardColumns.map((column) => ({
    ...column,
    tickets: [],
  }))
  const users: User[] = data.users.map((user) => ({
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    profilePictureBlurhash: user.profilePictureBlurhash,
    profilePictureVersion: user.profilePictureVersion,
  }))
  const labels: Label[] = ticket.project.labels
  const comments: TicketCommentView[] = ticket.comments.map((comment) => {
    const { displayName, secondaryLabel } =
      getCommentAuthorPresentation(comment)

    return {
      id: comment.id,
      body: comment.body,
      bodyDocument: comment.bodyDocument,
      attachments: comment.attachments,
      richAttachments: comment.richAttachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        contentType: attachment.contentType,
        size: attachment.size,
        isInline: attachment.isInline,
      })),
      source: comment.source,
      authorUserId: comment.authorUserId,
      displayName,
      secondaryLabel,
      avatarUrl: comment.discordAvatarUrl,
      avatarMember: comment.author
        ? {
            id: comment.author.id,
            firstName: comment.author.firstName,
            lastName: comment.author.lastName,
            profilePictureBlurhash: comment.author.profilePictureBlurhash,
            profilePictureVersion: comment.author.profilePictureVersion,
          }
        : null,
      discordMessageUrl: comment.discordMessageUrl,
      syncStatus: comment.syncStatus,
      lastSyncError: comment.lastSyncError,
      createdAt: comment.createdAt.toISOString(),
      editedAt: comment.editedAt?.toISOString() ?? null,
      deletedAt: comment.deletedAt?.toISOString() ?? null,
    }
  })

  return (
    <TicketDetail
      ticket={ticket as Ticket}
      project={{
        id: ticket.project.id,
        key: ticket.project.key,
        name: ticket.project.name,
      }}
      columns={columns}
      users={users}
      labels={labels}
      comments={comments}
      currentUserId={currentUser.helmUserId}
    />
  )
}
