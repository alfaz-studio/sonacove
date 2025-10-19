import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "./schema";
import {
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
} from "astro:env/server";

// Create a drizzle instance with environment-specific configuration
export function createDb() {
  const pool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    ssl: false, // Direct PostgreSQL connection without SSL termination
  });

  return drizzle({ client: pool, schema });
}
