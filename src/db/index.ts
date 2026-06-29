import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { z } from "zod"
import * as schema from "@/db/schema"

const DATABASE_URL = z.string().min(1).parse(process.env.DATABASE_URL)

const globalForDb = globalThis as unknown as {
  __logbookSql?: ReturnType<typeof postgres>
}

const client =
  globalForDb.__logbookSql ??
  postgres(DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  })

if (process.env.NODE_ENV !== "production") {
  globalForDb.__logbookSql = client
}

export const db = drizzle(client, { schema, casing: "snake_case" })
export { schema }
