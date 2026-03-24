import { Pool } from "pg";

export const db = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@127.0.0.1:5433/webhook_pipeline",
});
