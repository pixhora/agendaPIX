import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { databaseEnvSchema } from "./lib/env";

const env = databaseEnvSchema.parse(process.env);

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  dbCredentials: { url: env.DATABASE_URL },
  strict: true,
});
