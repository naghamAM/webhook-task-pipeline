import { db } from "./client";

async function main() {
  const result = await db.query("SELECT current_user, current_database()");
  console.log(result.rows);
  await db.end();
}

main().catch((error) => {
  console.error("DB connection test failed:", error);
});
