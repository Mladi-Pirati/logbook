"use client"

import { useEffect, useRef, useState, useTransition } from "react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { createTicket } from "@/actions/tickets"
import { fetchProjectColumns, fetchAllUsers } from "@/actions/fetch-project-data"

type Project = { id: string; key: string; name: string; icon: string; color: string }
type Column = { id: string; name: string; color: string; category: string }
type User = {
  id: string
  firstName: string
  lastName: string
  username: string
  profilePictureVersion: string | null
  profilePictureBlurhash: string | null
}

const PRIORITIES = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const

type Priority = "urgent" | "high" | "medium" | "low" | "none"

export function GlobalCreateDialog({
  open,
  onOpenChange,
  projects,
  initialProjectKey,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: Project[]
  initialProjectKey?: string
}) {
  const [pending, startTransition] = useTransition()
  const [loadingBoard, startLoadingBoard] = useTransition()

  const [selectedProjectKey, setSelectedProjectKey] = useState(initialProjectKey ?? "")
  const [projectColumns, setProjectColumns] = useState<Column[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const allUsersRef = useRef<Array<User>>([])

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [columnId, setColumnId] = useState("")
  const [priority, setPriority] = useState<Priority>("none")
  const [estimate, setEstimate] = useState("")
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  // Load columns + users when project changes
  useEffect(() => {
    if (!selectedProjectKey) return
    startLoadingBoard(async () => {
      const [cols, users] = await Promise.all([
        fetchProjectColumns(selectedProjectKey),
        allUsersRef.current.length === 0
          ? fetchAllUsers()
          : Promise.resolve(allUsersRef.current),
      ])
      setProjectColumns(cols as Column[])
      if (allUsersRef.current.length === 0) {
        allUsersRef.current = users
        setAllUsers(users)
      }
      setColumnId(cols[0]?.id ?? "")
    })
  }, [selectedProjectKey])

  function reset() {
    setTitle("")
    setDescription("")
    setColumnId("")
    setPriority("none")
    setEstimate("")
    setDueDate(undefined)
    setAssigneeIds([])
    setProjectColumns([])
  }

  const selectedProject = projects.find((p) => p.key === selectedProjectKey)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProject || !columnId) return
    startTransition(async () => {
      const result = await createTicket({
        projectId: selectedProject.id,
        projectKey: selectedProject.key,
        columnId,
        title,
        description: description || undefined,
        priority,
        estimate: estimate ? parseInt(estimate) : undefined,
        dueDate: dueDate?.toISOString(),
        assigneeIds,
        labelIds: [],
      })
      if (!result.ok) {
        toast.error("Failed to create ticket")
        return
      }
      toast.success(`${selectedProject.key}-${result.ticket.number} created`)
      onOpenChange(false)
      reset()
    })
  }

  const selectedAssignees = allUsers.filter((u) => assigneeIds.includes(u.id))

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create ticket</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          {/* Project selector */}
          <div className="grid gap-2">
            <Label>Project</Label>
            <Select
              value={selectedProjectKey}
              onValueChange={(v) => {
                if (!v) return
                setProjectColumns([])
                setColumnId("")
                setSelectedProjectKey(v)
              }}
            >
              <SelectTrigger>
                {selectedProject ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded text-xs shrink-0"
                      style={{ backgroundColor: selectedProject.color + "33" }}
                    >
                      {selectedProject.icon}
                    </span>
                    <span>{selectedProject.name}</span>
                    <span className="ml-1 font-mono text-xs text-muted-foreground">
                      {selectedProject.key}
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Select project…</span>
                )}
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded text-xs shrink-0"
                      style={{ backgroundColor: p.color + "33" }}
                    >
                      {p.icon}
                    </span>
                    {p.name}
                    <span className="ml-1 font-mono text-xs text-muted-foreground">{p.key}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="g-title">Title</Label>
            <Input
              id="g-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              required
              disabled={!selectedProject}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="g-desc">Description</Label>
            <Textarea
              id="g-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more context…"
              rows={3}
              disabled={!selectedProject}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Status</Label>
              {loadingBoard ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select
                  value={columnId}
                  onValueChange={(v) => { if (v) setColumnId(v) }}
                  disabled={!selectedProject || projectColumns.length === 0}
                >
                  <SelectTrigger>
                    {(() => {
                      const col = projectColumns.find((c) => c.id === columnId)
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
                    {projectColumns.map((col) => (
                      <SelectItem key={col.id} value={col.id}>
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: col.color }}
                        />
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => { if (v) setPriority(v as Priority) }}
                disabled={!selectedProject}
              >
                <SelectTrigger>
                  <span>{PRIORITIES.find((p) => p.value === priority)?.label ?? "None"}</span>
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="g-est">Estimate (points)</Label>
              <Input
                id="g-est"
                type="number"
                min={0}
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                placeholder="0"
                disabled={!selectedProject}
              />
            </div>

            <div className="grid gap-2">
              <Label>Due date</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger
                  disabled={!selectedProject}
                  className={cn(
                    "flex h-9 w-full items-center justify-start gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed",
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
                      onClick={(e) => { e.stopPropagation(); setDueDate(undefined) }}
                    />
                  )}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={(d) => { setDueDate(d); setCalendarOpen(false) }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Assignees</Label>
            <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
              <PopoverTrigger
                disabled={!selectedProject}
                className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-2">
                  {selectedAssignees.length === 0 ? (
                    <span className="text-muted-foreground">Unassigned</span>
                  ) : (
                    <div className="flex -space-x-1 items-center">
                      {selectedAssignees.slice(0, 4).map((u) => (
                        <MemberAvatar key={u.id} className="h-6 w-6 border border-background" member={u} />
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
                      {allUsers.map((u) => {
                        const selected = assigneeIds.includes(u.id)
                        return (
                          <CommandItem
                            key={u.id}
                            onSelect={() =>
                              setAssigneeIds((ids) =>
                                ids.includes(u.id)
                                  ? ids.filter((id) => id !== u.id)
                                  : [...ids, u.id],
                              )
                            }
                          >
                            <MemberAvatar className="mr-2 h-6 w-6" member={u} />
                            {u.firstName} {u.lastName}
                            <CheckIcon
                              className={cn("ml-auto h-4 w-4", selected ? "opacity-100" : "opacity-0")}
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

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { reset(); onOpenChange(false) }}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !selectedProject || !columnId}>
              {pending ? "Creating…" : "Create ticket"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
