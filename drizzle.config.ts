import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

/*
 * drizzle-kit evaluates this file in its own process, which does not inherit
 * `bun --env-file`, so the env is loaded here rather than relied on being
 * exported in the shell. A fresh clone that followed the README would
 * otherwise get "url: ''" and no clue which variable was missing.
 */
dotenv.config({ path: ".env.local", quiet: true });

export default defineConfig({
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  strict: true,
  verbose: true,
});
