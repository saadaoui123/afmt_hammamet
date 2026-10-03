import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// DATABASE_URL (Neon / PostgreSQL) est lu depuis l'environnement ou depuis .env (jamais versionné).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
