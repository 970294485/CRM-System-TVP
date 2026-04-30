import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { resolve } from "path";

import { sanitizeDatabaseUrl } from "./src/db/sanitize-database-url";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const databaseUrl = process.env.DATABASE_URL
  ? sanitizeDatabaseUrl(process.env.DATABASE_URL)
  : "";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
