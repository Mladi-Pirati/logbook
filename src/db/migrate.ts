import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"
import { z } from "zod"

const DATABASE_URL = z.string().parse(process.env.DATABASE_URL)

const migrationClient = postgres(DATABASE_URL, { max: 1 })

await migrate(drizzle(migrationClient, { casing: "snake_case" }), {
  migrationsFolder: "./src/db/migrations",
})

await migrationClient.end()
console.log("Migrations applied successfully")
