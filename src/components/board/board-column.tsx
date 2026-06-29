"use client"

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { useDroppable } from "@dnd-kit/core"
import { DotsThreeIcon, PencilIcon, TrashIcon } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { TicketCard } from "./ticket-card"
import { cn } from "@/lib/utils"
import type { Column, Ticket } from "./types"

export function BoardColumn({
  column,
  projectKey,
  onTicketClick,
  onEditColumn,
  onDeleteColumn,
}: {
  column: Column
  projectKey: string
  onTicketClick: (ticket: Ticket) => void
  onEditColumn: () => void
  onDeleteColumn: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between gap-1 px-3 py-2.5 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: column.color }}
          />
          <h3 className="text-sm font-medium truncate">{column.name}</h3>
          <Badge variant="secondary" className="text-xs h-5 px-1.5 tabular-nums shrink-0">
            {column.tickets.length}
            {column.wipLimit ? `/${column.wipLimit}` : ""}
          </Badge>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 shrink-0"
                title="Column options"
              />
            }
          >
            <DotsThreeIcon className="h-4 w-4" weight="bold" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEditColumn}>
              <PencilIcon className="h-4 w-4 mr-2" />
              Edit column
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDeleteColumn}
              className="text-destructive focus:text-destructive"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete column
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1">
        <SortableContext
          items={column.tickets.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div
            ref={setNodeRef}
            className={cn(
              "flex flex-col gap-2 p-2 min-h-16 transition-colors",
              isOver && "bg-primary/5",
            )}
          >
            {column.tickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                projectKey={projectKey}
                onClick={() => onTicketClick(ticket)}
              />
            ))}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  )
}
