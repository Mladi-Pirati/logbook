"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, formatDistanceToNow } from "date-fns"
import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  DiscordLogoIcon,
  LinkIcon,
  PencilSimpleIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { TicketDialog } from "@/components/board/ticket-dialog"
import type {
  Column,
  Label,
  Project,
  Ticket,
  User,
} from "@/components/board/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MemberAvatar, type AvatarMember } from "@/components/member-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  createTicketComment,
  deleteTicketComment,
  retryTicketCommentSync,
  updateTicketComment,
} from "@/actions/comments"

export type TicketCommentView = {
  id: string
  body: string | null
  attachments: Array<{
    id: string
    fileName: string
    url: string
    contentType: string | null
    size: number
  }>
  source: "logbook" | "discord"
  authorUserId: string | null
  displayName: string
  secondaryLabel: string | null
  avatarUrl: string | null
  avatarMember: AvatarMember | null
  discordMessageUrl: string | null
  syncStatus: "pending" | "synced" | "failed"
  lastSyncError: string | null
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
}

export function TicketDetail({
  ticket,
  project,
  columns,
  users,
  labels,
  comments,
  currentUserId,
}: {
  ticket: Ticket
  project: Project
  columns: Column[]
  users: User[]
  labels: Label[]
  comments: TicketCommentView[]
  currentUserId: string
}) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh()
    }
    const interval = window.setInterval(refresh, 10_000)
    window.addEventListener("focus", refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", refresh)
    }
  }, [router])

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href)
    toast.success("Ticket link copied")
  }

  const status = columns.find((column) => column.id === ticket.columnId)

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="border-b px-4 py-3">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={
            <Link href={`/projects/${project.key}/board`}>
              <ArrowLeftIcon />
                  Back to board
                </Link>
              }
            />
            <Button variant="outline" size="sm" onClick={copyLink}>
              <CopyIcon />
              Copy link
            </Button>
          </div>
        </div>

        <main className="mx-auto grid w-full max-w-6xl gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid content-start gap-5">
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">
                    {project.key}-{ticket.number}
                  </span>
                  <span>{ticket.title}</span>
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <MemberAvatar className="size-6" member={ticket.reporter} />
                  Reported by {ticket.reporter.firstName} {ticket.reporter.lastName}
                </CardDescription>
                <CardAction>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditOpen(true)}
                  >
                    <PencilSimpleIcon />
                    Edit ticket
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="grid gap-4">
                <p className="whitespace-pre-wrap text-sm">
                  {ticket.description || (
                    <span className="text-muted-foreground">
                      No description.
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {status?.name ?? "Unknown status"}
                  </Badge>
                  <Badge variant="outline">Priority: {ticket.priority}</Badge>
                  {ticket.estimate !== null && (
                    <Badge variant="outline">
                      Estimate: {ticket.estimate}
                    </Badge>
                  )}
                  {ticket.dueDate && (
                    <Badge variant="outline">
                      Due {format(new Date(ticket.dueDate), "MMM d, yyyy")}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <TicketComments
              ticketId={ticket.id}
              comments={comments}
              currentUserId={currentUserId}
            />
          </div>

          <Card className="h-fit">
            <CardHeader className="border-b">
              <CardTitle>People and labels</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <span className="text-xs font-medium">Assignees</span>
                {ticket.assignees.length ? (
                  ticket.assignees.map(({ user }) => (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground" key={user.id}>
                      <MemberAvatar className="size-6" member={user} />
                      {user.firstName} {user.lastName}
                    </div>
                  ))
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </div>
              <InfoList
                label="Labels"
                values={ticket.ticketLabels.map(({ label }) => label.name)}
              />
              <InfoList
                label="Created"
                values={[format(new Date(ticket.createdAt), "MMM d, yyyy HH:mm")]}
              />
            </CardContent>
          </Card>
        </main>
      </div>

      <TicketDialog
        key={ticket.updatedAt.toString()}
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
        columns={columns}
        users={users}
        labels={labels}
        ticket={ticket}
      />
    </>
  )
}

function InfoList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">
        {values.length > 0 ? values.join(", ") : "—"}
      </span>
    </div>
  )
}

function TicketComments({
  ticketId,
  comments,
  currentUserId,
}: {
  ticketId: string
  comments: TicketCommentView[]
  currentUserId: string
}) {
  const [body, setBody] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState("")
  const [pending, startTransition] = useTransition()

  function submitComment() {
    startTransition(async () => {
      const result = await createTicketComment({ ticketId, body })
      if (!result.ok) {
        toast.error("Could not add comment")
        return
      }
      setBody("")
      if (result.synced) toast.success("Comment added")
      else toast.warning("Comment saved, but Discord sync failed")
    })
  }

  function saveEdit(commentId: string) {
    startTransition(async () => {
      const result = await updateTicketComment({
        commentId,
        body: editingBody,
      })
      if (!result.ok) {
        toast.error("Could not update comment")
        return
      }
      setEditingId(null)
      if (!result.synced) {
        toast.warning("Comment updated, but Discord sync failed")
      }
    })
  }

  function removeComment(commentId: string) {
    startTransition(async () => {
      const result = await deleteTicketComment(commentId)
      if (!result.ok) {
        toast.error("Could not delete comment")
      } else if (!result.synced) {
        toast.warning("Comment deleted, but Discord sync failed")
      }
    })
  }

  function retry(commentId: string) {
    startTransition(async () => {
      const result = await retryTicketCommentSync(commentId)
      if (!result.ok || !result.synced) toast.error("Discord retry failed")
      else toast.success("Discord sync restored")
    })
  }

  const visible = comments.filter(
    (comment) =>
      !comment.deletedAt ||
      (comment.authorUserId === currentUserId &&
        comment.syncStatus === "failed"),
  )

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Comments</CardTitle>
        <CardDescription>
          Messages are synchronized with the ticket&apos;s Discord thread.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        )}
        {visible.map((comment) => {
          const isOwnLogbookComment =
            comment.source === "logbook" &&
            comment.authorUserId === currentUserId

          if (comment.deletedAt) {
            return (
              <div
                key={comment.id}
                className="flex items-center justify-between border border-destructive/30 bg-destructive/5 p-3"
              >
                <span className="text-xs text-destructive">
                  A deleted comment has not been removed from Discord.
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={pending}
                  onClick={() => retry(comment.id)}
                >
                  Retry
                </Button>
              </div>
            )
          }

          return (
            <article key={comment.id} className="flex gap-3 border-b pb-4">
              {comment.avatarMember ? (
                <MemberAvatar member={comment.avatarMember} />
              ) : (
                <Avatar>
                  {comment.avatarUrl ? <AvatarImage src={comment.avatarUrl} alt="" /> : null}
                  <AvatarFallback>{initials(comment.displayName)}</AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-medium">
                    {comment.displayName}
                  </span>
                  {comment.secondaryLabel && (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {comment.secondaryLabel}
                    </span>
                  )}
                  <span
                    className="text-xs text-muted-foreground"
                    title={format(new Date(comment.createdAt), "PPpp")}
                  >
                    {formatDistanceToNow(new Date(comment.createdAt), {
                      addSuffix: true,
                    })}
                    {comment.editedAt ? " · edited" : ""}
                  </span>
                  {comment.source === "discord" && (
                    <DiscordLogoIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>

                {editingId === comment.id ? (
                  <div className="mt-2 grid gap-2">
                    <Textarea
                      maxLength={2000}
                      value={editingBody}
                      onChange={(event) => setEditingBody(event.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="xs"
                        disabled={pending || !editingBody.trim()}
                        onClick={() => saveEdit(comment.id)}
                      >
                        <CheckIcon />
                        Save
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {comment.body}
                  </p>
                )}

                {comment.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {comment.attachments.map((attachment) => (
                      <a
                        key={attachment.id}
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <LinkIcon />
                        {attachment.fileName}
                      </a>
                    ))}
                  </div>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {comment.discordMessageUrl && (
                      <Button
                        size="xs"
                        variant="ghost"
                        nativeButton={false}
                        render={
                          <a
                            href={comment.discordMessageUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open in Discord
                        </a>
                      }
                    />
                  )}
                  {isOwnLogbookComment && editingId !== comment.id && (
                    <>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        title="Edit comment"
                        onClick={() => {
                          setEditingId(comment.id)
                          setEditingBody(comment.body ?? "")
                        }}
                      >
                        <PencilSimpleIcon />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        title="Delete comment"
                        onClick={() => removeComment(comment.id)}
                      >
                        <TrashIcon />
                      </Button>
                    </>
                  )}
                  {isOwnLogbookComment &&
                    comment.syncStatus === "failed" && (
                      <Button
                        size="xs"
                        variant="destructive"
                        disabled={pending}
                        onClick={() => retry(comment.id)}
                      >
                        <WarningCircleIcon />
                        Retry Discord sync
                      </Button>
                    )}
                </div>
              </div>
            </article>
          )
        })}

        <div className="grid gap-2 border-t pt-4">
          <Textarea
            value={body}
            maxLength={2000}
            rows={4}
            placeholder="Add a comment…"
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {body.length}/2000
            </span>
            <Button
              disabled={pending || !body.trim()}
              onClick={submitComment}
            >
              Add comment
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}
