"use client"

import { useState, useOptimistic, useTransition } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { toast } from "sonner"
import { PlusIcon } from "@phosphor-icons/react"
import { TicketCard } from "./ticket-card"
import { BoardColumn } from "./board-column"
import { TicketDialog } from "./ticket-dialog"
import { ColumnDialog } from "./column-dialog"
import { moveTicket } from "@/actions/tickets"
import { deleteColumn } from "@/actions/boards"
import type { Board as BoardType, Column, Project, Ticket, User } from "./types"

type UserRow = {
  id: string
  username: string
  firstName: string
  lastName: string
  syncedAt: Date
}

function midpoint(a: number, b: number) {
  return (a + b) / 2
}

function getNextPosition(tickets: Ticket[], overIndex: number): number {
  if (tickets.length === 0) return 1024
  if (overIndex <= 0) return tickets[0].position / 2
  if (overIndex >= tickets.length) return tickets[tickets.length - 1].position + 1024
  return midpoint(tickets[overIndex - 1].position, tickets[overIndex].position)
}

export function Board({
  project,
  board,
  users,
}: {
  project: Project
  board: BoardType
  users: UserRow[]
}) {
  const [, startTransition] = useTransition()
  const [optimisticColumns, applyOptimistic] = useOptimistic(board.columns)
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)

  // Ticket dialog state
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false)
  const [editingTicket, setEditingTicket] = useState<Ticket | undefined>()

  // Column dialog state
  const [columnDialogOpen, setColumnDialogOpen] = useState(false)
  const [editingColumn, setEditingColumn] = useState<Column | undefined>()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  )

  const allTickets = optimisticColumns.flatMap((c) => c.tickets)

  function handleDragStart(event: DragStartEvent) {
    const ticket = allTickets.find((t) => t.id === event.active.id)
    setActiveTicket(ticket ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTicket(null)

    if (!over) return

    const draggedTicket = allTickets.find((t) => t.id === active.id)
    if (!draggedTicket) return

    const targetColumnId =
      optimisticColumns.find((c) => c.id === over.id)?.id ??
      allTickets.find((t) => t.id === over.id)?.columnId

    if (!targetColumnId) return

    const targetColumn = optimisticColumns.find((c) => c.id === targetColumnId)
    if (!targetColumn) return

    const isSameColumn = draggedTicket.columnId === targetColumnId
    const targetTickets = targetColumn.tickets.filter((t) => t.id !== draggedTicket.id)

    let overIndex: number
    if (over.id === targetColumnId) {
      overIndex = targetTickets.length
    } else {
      overIndex = targetTickets.findIndex((t) => t.id === over.id)
      if (overIndex === -1) overIndex = targetTickets.length
    }

    const newPosition = getNextPosition(targetTickets, overIndex)

    startTransition(async () => {
      applyOptimistic((cols) =>
        cols.map((col) => {
          if (col.id === draggedTicket.columnId && !isSameColumn) {
            return { ...col, tickets: col.tickets.filter((t) => t.id !== draggedTicket.id) }
          }
          if (col.id === targetColumnId) {
            const withoutDragged = col.tickets.filter((t) => t.id !== draggedTicket.id)
            const updated = { ...draggedTicket, columnId: targetColumnId, position: newPosition }
            const inserted = [...withoutDragged, updated].sort((a, b) => a.position - b.position)
            return { ...col, tickets: inserted }
          }
          return col
        }),
      )
      const result = await moveTicket({
        ticketId: draggedTicket.id,
        columnId: targetColumnId,
        position: newPosition,
        projectKey: project.key,
      })
      if (!result.ok) toast.error("Failed to move ticket")
    })
  }

  function openEditTicket(ticket: Ticket) {
    setEditingTicket(ticket)
    setTicketDialogOpen(true)
  }

  function openCreateColumn() {
    setEditingColumn(undefined)
    setColumnDialogOpen(true)
  }

  function openEditColumn(col: Column) {
    setEditingColumn(col)
    setColumnDialogOpen(true)
  }

  function handleDeleteColumn(col: Column) {
    if (col.tickets.length > 0) {
      toast.error(`Move or delete the ${col.tickets.length} ticket(s) in "${col.name}" first`)
      return
    }
    startTransition(async () => {
      const result = await deleteColumn(col.id, project.key)
      if (!result.ok) toast.error("Failed to delete column")
      else toast.success(`Column "${col.name}" deleted`)
    })
  }

  const allLabels = [...new Map(
    optimisticColumns
      .flatMap((c) => c.tickets)
      .flatMap((t) => t.ticketLabels.map((tl) => tl.label))
      .map((l) => [l.id, l]),
  ).values()]

  const mappedUsers: User[] = users.map((u) => ({
    id: u.id,
    username: u.username,
    firstName: u.firstName,
    lastName: u.lastName,
  }))

  const nextColumnPosition =
    Math.max(0, ...optimisticColumns.map((c) => c.position)) + 1024

  return (
    <>
      <div className="flex flex-1 overflow-x-auto overflow-y-hidden p-4 gap-3">
        <DndContext
          id="board-dnd"
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {optimisticColumns.map((col) => (
            <BoardColumn
              key={col.id}
              column={col}
              projectKey={project.key}
              onTicketClick={openEditTicket}
              onEditColumn={() => openEditColumn(col)}
              onDeleteColumn={() => handleDeleteColumn(col)}
            />
          ))}

          <DragOverlay>
            {activeTicket && (
              <TicketCard
                ticket={activeTicket}
                projectKey={project.key}
                onClick={() => {}}
                isDragging
              />
            )}
          </DragOverlay>
        </DndContext>

        {/* Add column button — outside DndContext so it doesn't interfere with drag */}
        <button
          onClick={openCreateColumn}
          className="flex h-10 w-72 shrink-0 items-center gap-2 self-start rounded-lg border border-dashed px-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <PlusIcon className="h-4 w-4" />
          Add column
        </button>
      </div>

      <TicketDialog
        key={editingTicket?.id ?? "new"}
        open={ticketDialogOpen}
        onOpenChange={setTicketDialogOpen}
        project={project}
        columns={optimisticColumns}
        users={mappedUsers}
        labels={allLabels}
        ticket={editingTicket}
      />

      <ColumnDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        boardId={board.id}
        projectKey={project.key}
        column={editingColumn}
        nextPosition={nextColumnPosition}
      />
    </>
  )
}
