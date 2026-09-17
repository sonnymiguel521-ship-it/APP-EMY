import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL && existsSync(".env")) {
  process.loadEnvFile(".env");
}

const url = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL (o DRIZZLE_DATABASE_URL) no está definida");
}

export default defineConfig({
  out: "./drizzle",
  schema: ["./src/lib/db/schema.ts", "./src/lib/db/auth-schema.ts"],
  dialect: "postgresql",
  strict: true,
  dbCredentials: { url },
});
