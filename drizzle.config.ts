import { defineConfig } from "drizzle-kit"
import { z } from "zod"

const DATABASE_URL = z.string().min(1).parse(process.env.DATABASE_URL)

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dbCredentials: { url: DATABASE_URL },
  casing: "snake_case",
  strict: true,
  verbose: true,
})
