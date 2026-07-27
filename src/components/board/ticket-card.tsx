"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { format } from "date-fns"
import {
  CalendarIcon,
  CircleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import { MemberAvatar } from "@/components/member-avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Ticket } from "./types"

const PRIORITY_ICONS = {
  urgent: <WarningIcon className="h-3.5 w-3.5 text-red-500" weight="fill" />,
  high: <ArrowUpIcon className="h-3.5 w-3.5 text-orange-500" weight="bold" />,
  medium: <ArrowUpIcon className="h-3.5 w-3.5 text-yellow-500" />,
  low: <ArrowDownIcon className="h-3.5 w-3.5 text-blue-400" />,
  none: <CircleIcon className="h-3.5 w-3.5 text-muted-foreground/40" />,
}

export function TicketCard({
  ticket,
  projectKey,
  onClick,
  isDragging = false,
}: {
  ticket: Ticket
  projectKey: string
  onClick: () => void
  isDragging?: boolean
}) {
  const { setNodeRef, attributes, listeners, transform, transition } =
    useSortable({ id: ticket.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isOverdue =
    ticket.dueDate &&
    new Date(ticket.dueDate) < new Date() &&
    !ticket.completedAt

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "group relative rounded-md border bg-card p-3 shadow-sm cursor-pointer",
        "hover:border-primary/50 hover:shadow-md transition-all select-none",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-mono text-muted-foreground shrink-0">
          {projectKey}-{ticket.number}
        </span>
        {PRIORITY_ICONS[ticket.priority]}
      </div>

      <p className="text-sm font-medium leading-snug line-clamp-2 mb-2">
        {ticket.title}
      </p>

      {ticket.ticketLabels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {ticket.ticketLabels.slice(0, 3).map(({ label }) => (
            <span
              key={label.id}
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: label.color + "22",
                color: label.color,
                border: `1px solid ${label.color}44`,
              }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="flex items-center gap-2">
          {ticket.estimate !== null && (
            <Badge variant="secondary" className="text-xs h-5 px-1.5 font-mono">
              {ticket.estimate}
            </Badge>
          )}
          {ticket.dueDate && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs",
                isOverdue ? "text-destructive" : "text-muted-foreground",
              )}
            >
              <CalendarIcon className="h-3 w-3" />
              {format(new Date(ticket.dueDate), "MMM d")}
            </span>
          )}
        </div>

        {ticket.assignees.length > 0 && (
          <div className="flex -space-x-1">
            {ticket.assignees.slice(0, 3).map(({ user }) => (
              <MemberAvatar
                key={user.id}
                className="h-5 w-5 border border-background text-[9px]"
                member={user}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function TicketCardSkeleton() {
  return (
    <div className="rounded-md border bg-card p-3 opacity-50">
      <div className="h-3 w-16 bg-muted rounded animate-pulse mb-2" />
      <div className="h-4 w-full bg-muted rounded animate-pulse mb-1" />
      <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
    </div>
  )
}
