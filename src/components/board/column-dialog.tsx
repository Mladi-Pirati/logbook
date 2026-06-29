"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createColumn, updateColumn } from "@/actions/boards"
import { cn } from "@/lib/utils"
import type { Column } from "./types"

const PRESET_COLORS = [
  "#6b7280", // gray
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#10b981", // emerald
  "#ef4444", // red
  "#f97316", // orange
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
]

export function ColumnDialog({
  open,
  onOpenChange,
  boardId,
  projectKey,
  column,
  nextPosition,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardId: string
  projectKey: string
  column?: Column
  nextPosition?: number
}) {
  const [pending, startTransition] = useTransition()
  const isEdit = !!column

  const [name, setName] = useState(column?.name ?? "")
  const [color, setColor] = useState(column?.color ?? PRESET_COLORS[0])
  const [wipLimit, setWipLimit] = useState(column?.wipLimit?.toString() ?? "")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const parsedWip = wipLimit ? parseInt(wipLimit) : undefined

      const result = isEdit
        ? await updateColumn({
            id: column!.id,
            name,
            color,
            wipLimit: parsedWip ?? null,
            projectKey,
          })
        : await createColumn({
            boardId,
            name,
            color,
            position: nextPosition ?? 1024,
            projectKey,
          })

      if (!result.ok) {
        toast.error(isEdit ? "Failed to update column" : "Failed to create column")
        return
      }

      toast.success(isEdit ? "Column updated" : "Column created")
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit column" : "New column"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="col-name">Name</Label>
            <Input
              id="col-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Column name"
              required
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                    color === c ? "border-foreground scale-110" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="wip">
              WIP limit{" "}
              <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </Label>
            <Input
              id="wip"
              type="number"
              min={1}
              value={wipLimit}
              onChange={(e) => setWipLimit(e.target.value)}
              placeholder="No limit"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save" : "Create column"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
