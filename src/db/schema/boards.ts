import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { columnCategory } from "./enums"
import { projects } from "./projects"

export const boards = pgTable("boards", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const columns = pgTable(
  "columns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: columnCategory("category").notNull(),
    position: doublePrecision("position").notNull(),
    color: text("color").notNull().default("#6b7280"),
    wipLimit: integer("wip_limit"),
  },
  (t) => [index("columns_board_position_idx").on(t.boardId, t.position)],
)
