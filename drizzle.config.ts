import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.DB_HOST || "staj.sonacove.com",
    port: parseInt(process.env.DB_PORT || "5432"),
    user: process.env.DB_USER || "cf",
    password: process.env.DB_PASSWORD || "pass123",
    database: process.env.DB_NAME || "keycloak",
    ssl: false, // can be boolean | "require" | "allow" | "prefer" | "verify-full" | options from node:tls
  },
  migrations: {
    // this is used to store drizzle metadata, DO NOT CHANGE
    // table: '', // `__drizzle_migrations` by default
    schema: "drizzle", // `public` by default
  },
});
