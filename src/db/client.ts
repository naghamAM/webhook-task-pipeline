import { Pool } from "pg";

export const db = new Pool({
  host: "127.0.0.1",
  port: 5433,
  user: "postgres",
  password: "postgres",
  database: "webhook_pipeline",
});
