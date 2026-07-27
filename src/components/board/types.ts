export type User = {
  id: string
  username: string
  firstName: string
  lastName: string
  profilePictureVersion: string | null
  profilePictureBlurhash: string | null
}

export type Label = {
  id: string
  name: string
  color: string
}

export type Ticket = {
  id: string
  projectId: string
  number: number
  title: string
  description: string | null
  columnId: string
  parentId: string | null
  reporterId: string
  estimate: number | null
  dueDate: Date | null
  position: number
  priority: "urgent" | "high" | "medium" | "low" | "none"
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
  assignees: { user: User }[]
  ticketLabels: { label: Label }[]
  reporter: User
}

export type Column = {
  id: string
  boardId: string
  name: string
  category:
    | "backlog"
    | "in_progress"
    | "testing"
    | "pending"
    | "done"
    | "rejected"
    | "custom"
  position: number
  color: string
  wipLimit: number | null
  tickets: Ticket[]
}

export type Board = {
  id: string
  projectId: string
  name: string
  columns: Column[]
}

export type Project = {
  id: string
  key: string
  name: string
}
