"use client"

import { useState, useTransition } from "react"
import dynamic from "next/dynamic"
import { Theme as EmojiTheme } from "emoji-picker-react"
import { toast } from "sonner"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { updateProject, deleteProject } from "@/actions/projects"

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false })

const PRESET_COLORS = [
  "#6366f1",
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#84cc16",
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#6b7280",
  "#0f172a",
]

type Project = {
  id: string
  key: string
  name: string
  description: string | null
  color: string
  icon: string
}

export function EditProjectDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
}) {
  const { resolvedTheme } = useTheme()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [deleting, startDelete] = useTransition()

  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? "")
  const [color, setColor] = useState(project.color)
  const [icon, setIcon] = useState(project.icon)
  const [emojiOpen, setEmojiOpen] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateProject({
        id: project.id,
        name,
        description: description || undefined,
        color,
        icon,
      })
      if (!result.ok) {
        toast.error("Failed to update project")
        return
      }
      toast.success("Project updated")
      onOpenChange(false)
    })
  }

  function handleDelete() {
    startDelete(async () => {
      const result = await deleteProject(project.id)
      if (!result.ok) {
        toast.error("Failed to delete project")
        return
      }
      toast.success(`Project "${project.name}" deleted`)
      onOpenChange(false)
      router.push("/projects")
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="flex items-center gap-4">
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger
                className="flex h-14 w-14 items-center justify-center rounded-xl border-2 text-2xl transition-colors hover:bg-accent"
                style={{ borderColor: color, backgroundColor: color + "22" }}
                title="Change icon"
              >
                {icon}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border-0" align="start">
                <EmojiPicker
                  theme={resolvedTheme === "dark" ? EmojiTheme.DARK : EmojiTheme.LIGHT}
                  onEmojiClick={(e) => {
                    setIcon(e.emoji)
                    setEmojiOpen(false)
                  }}
                  width={320}
                  height={380}
                  searchPlaceholder="Search emoji…"
                  lazyLoadEmojis
                />
              </PopoverContent>
            </Popover>

            <div className="grid flex-1 gap-1">
              <p className="text-sm font-medium">Icon &amp; color</p>
              <p className="text-xs text-muted-foreground">
                Click the icon to change emoji
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-5 w-5 rounded-full border-2 transition-transform hover:scale-110",
                      color === c ? "border-foreground scale-110" : "border-transparent",
                    )}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="proj-key">
              Key{" "}
              <span className="text-muted-foreground font-normal text-xs">(read-only)</span>
            </Label>
            <Input
              id="proj-key"
              value={project.key}
              readOnly
              className="opacity-50 cursor-not-allowed font-mono"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="proj-name">Name</Label>
            <Input
              id="proj-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="proj-desc">
              Description{" "}
              <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </Label>
            <Textarea
              id="proj-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>

        <Separator />

        <div className="grid gap-2">
          <p className="text-sm font-medium text-destructive">Danger zone</p>
          <p className="text-xs text-muted-foreground">
            Permanently delete this project and all its tickets. This cannot be undone.
          </p>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="outline"
                  className="w-full border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  disabled={deleting}
                />
              }
            >
              {deleting ? "Deleting…" : "Delete project"}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete &ldquo;{project.name}&rdquo;?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the project, all its tickets, columns, and
                  labels. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel render={<Button variant="outline" />}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  render={
                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                    />
                  }
                >
                  Delete project
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DialogContent>
    </Dialog>
  )
}
