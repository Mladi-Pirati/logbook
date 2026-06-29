"use client"

import { useState, useTransition } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { Theme as EmojiTheme } from "emoji-picker-react"
import { toast } from "sonner"
import { useTheme } from "next-themes"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { createProject } from "@/actions/projects"

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

export function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const [pending, startTransition] = useTransition()

  const [key, setKey] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [icon, setIcon] = useState("📋")
  const [emojiOpen, setEmojiOpen] = useState(false)

  function suggestKey(value: string) {
    setKey(value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))
  }

  function reset() {
    setKey("")
    setName("")
    setDescription("")
    setColor(PRESET_COLORS[0])
    setIcon("📋")
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createProject({ key, name, description, color, icon })
      if (!result.ok) {
        toast.error("Failed to create project")
        return
      }
      toast.success(`Project ${result.project.name} created`)
      onOpenChange(false)
      reset()
      router.push(`/projects/${result.project.key}/board`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          {/* Icon + color */}
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
              <p className="text-xs text-muted-foreground">Click the icon to change emoji</p>
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
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Engineering"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!key) suggestKey(e.target.value)
              }}
              required
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="key">
              Key{" "}
              <span className="text-muted-foreground font-normal text-xs">(e.g. ENG)</span>
            </Label>
            <Input
              id="key"
              placeholder="ENG"
              value={key}
              onChange={(e) =>
                setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))
              }
              minLength={1}
              required
              className="font-mono uppercase"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">
              Description{" "}
              <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </Label>
            <Textarea
              id="description"
              placeholder="What is this project about?"
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
              {pending ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
