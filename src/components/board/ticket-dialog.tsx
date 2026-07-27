"use client"

import { useState, useTransition } from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  CalendarIcon,
  XIcon,
  CheckIcon,
  CaretUpDownIcon,
} from "@phosphor-icons/react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { MemberAvatar } from "@/components/member-avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { createTicket, updateTicket } from "@/actions/tickets"
import type { Column, Ticket, User, Label as LabelType, Project } from "./types"

const PRIORITIES = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const

type Priority = "urgent" | "high" | "medium" | "low" | "none"

export function TicketDialog({
  open,
  onOpenChange,
  project,
  columns,
  users,
  labels,
  ticket,
  defaultColumnId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
  columns: Column[]
  users: User[]
  labels: LabelType[]
  ticket?: Ticket
  defaultColumnId?: string
}) {
  const [pending, startTransition] = useTransition()
  const isEdit = !!ticket

  const [title, setTitle] = useState(ticket?.title ?? "")
  const [description, setDescription] = useState(ticket?.description ?? "")
  const [columnId, setColumnId] = useState(
    ticket?.columnId ?? defaultColumnId ?? columns[0]?.id ?? "",
  )
  const [priority, setPriority] = useState<Priority>(ticket?.priority ?? "none")
  const [estimate, setEstimate] = useState(ticket?.estimate?.toString() ?? "")
  const [dueDate, setDueDate] = useState<Date | undefined>(
    ticket?.dueDate ? new Date(ticket.dueDate) : undefined,
  )
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    ticket?.assignees.map((a) => a.user.id) ?? [],
  )
  const [labelIds, setLabelIds] = useState<string[]>(
    ticket?.ticketLabels.map((tl) => tl.label.id) ?? [],
  )
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [labelOpen, setLabelOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  function toggleAssignee(userId: string) {
    setAssigneeIds((ids) =>
      ids.includes(userId)
        ? ids.filter((id) => id !== userId)
        : [...ids, userId],
    )
  }

  function toggleLabel(labelId: string) {
    setLabelIds((ids) =>
      ids.includes(labelId)
        ? ids.filter((id) => id !== labelId)
        : [...ids, labelId],
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const payload = {
        title,
        description: description || undefined,
        columnId,
        priority,
        estimate: estimate ? parseInt(estimate) : undefined,
        dueDate: dueDate?.toISOString(),
        assigneeIds,
        labelIds,
        projectKey: project.key,
      }

      const result = isEdit
        ? await updateTicket({ id: ticket!.id, ...payload })
        : await createTicket({ projectId: project.id, ...payload })

      if (!result.ok) {
        toast.error("Failed to save ticket")
        return
      }

      toast.success(isEdit ? "Ticket updated" : "Ticket created")
      onOpenChange(false)
    })
  }

  const selectedAssignees = users.filter((u) => assigneeIds.includes(u.id))
  const selectedLabels = labels.filter((l) => labelIds.includes(l.id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? `${project.key}-${ticket!.number} · Edit ticket`
              : "New ticket"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ticket title"
              required
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more context…"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={columnId}
                onValueChange={(v) => { if (v) setColumnId(v) }}
              >
                <SelectTrigger>
                  {(() => {
                    const col = columns.find((c) => c.id === columnId)
                    return col ? (
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: col.color }}
                        />
                        {col.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Select status</span>
                    )
                  })()}
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => { if (v) setPriority(v as Priority) }}
              >
                <SelectTrigger>
                  <span>{PRIORITIES.find((p) => p.value === priority)?.label ?? "None"}</span>
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="estimate">Estimate (points)</Label>
              <Input
                id="estimate"
                type="number"
                min={0}
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="grid gap-2">
              <Label>Due date</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger
                  className={cn(
                    "flex h-9 w-full items-center justify-start gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors hover:bg-accent",
                    !dueDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">
                    {dueDate ? format(dueDate, "MMM d, yyyy") : "Pick a date"}
                  </span>
                  {dueDate && (
                    <XIcon
                      className="h-4 w-4 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDueDate(undefined)
                      }}
                    />
                  )}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={(d) => {
                      setDueDate(d)
                      setCalendarOpen(false)
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Assignees</Label>
            <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
              <PopoverTrigger
                className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors hover:bg-accent"
              >
                <div className="flex items-center gap-2">
                  {selectedAssignees.length === 0 ? (
                    <span className="text-muted-foreground">Unassigned</span>
                  ) : (
                    <div className="flex -space-x-1 items-center">
                      {selectedAssignees.slice(0, 4).map((u) => (
                        <MemberAvatar
                          key={u.id}
                          className="h-6 w-6 border border-background"
                          member={u}
                        />
                      ))}
                      {selectedAssignees.length > 4 && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          +{selectedAssignees.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <CaretUpDownIcon className="h-4 w-4 opacity-50 shrink-0" />
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search members…" />
                  <CommandList>
                    <CommandEmpty>No members found.</CommandEmpty>
                    <CommandGroup>
                      {users.map((u) => {
                        const selected = assigneeIds.includes(u.id)
                        return (
                          <CommandItem
                            key={u.id}
                            onSelect={() => toggleAssignee(u.id)}
                          >
                            <MemberAvatar className="mr-2 h-6 w-6" member={u} />
                            <span>
                              {u.firstName} {u.lastName}
                            </span>
                            <CheckIcon
                              className={cn(
                                "ml-auto h-4 w-4",
                                selected ? "opacity-100" : "opacity-0",
                              )}
                            />
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {labels.length > 0 && (
            <div className="grid gap-2">
              <Label>Labels</Label>
              <Popover open={labelOpen} onOpenChange={setLabelOpen}>
                <PopoverTrigger
                  className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors hover:bg-accent"
                >
                  <div className="flex flex-wrap gap-1">
                    {selectedLabels.length === 0 ? (
                      <span className="text-muted-foreground">No labels</span>
                    ) : (
                      selectedLabels.map((l) => (
                        <Badge
                          key={l.id}
                          style={{
                            backgroundColor: l.color + "22",
                            color: l.color,
                            border: `1px solid ${l.color}44`,
                          }}
                          className="text-xs"
                        >
                          {l.name}
                        </Badge>
                      ))
                    )}
                  </div>
                  <CaretUpDownIcon className="h-4 w-4 opacity-50 shrink-0" />
                </PopoverTrigger>
                <PopoverContent className="w-56 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search labels…" />
                    <CommandList>
                      <CommandEmpty>No labels found.</CommandEmpty>
                      <CommandGroup>
                        {labels.map((l) => {
                          const selected = labelIds.includes(l.id)
                          return (
                            <CommandItem
                              key={l.id}
                              onSelect={() => toggleLabel(l.id)}
                            >
                              <span
                                className="h-3 w-3 rounded-full mr-2 shrink-0"
                                style={{ backgroundColor: l.color }}
                              />
                              {l.name}
                              <CheckIcon
                                className={cn(
                                  "ml-auto h-4 w-4",
                                  selected ? "opacity-100" : "opacity-0",
                                )}
                              />
                            </CommandItem>
                          )
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Create ticket"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
