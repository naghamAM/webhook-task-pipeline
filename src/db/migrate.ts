import { readFile } from "fs/promises";
import path from "path";
import { db } from "./client";

async function runSqlFile(fileName: string) {
  const filePath = path.resolve(process.cwd(), "src", "db", fileName);
  const sql = await readFile(filePath, "utf8");
  await db.query(sql);
  console.log(`Applied ${fileName}`);
}

async function main() {
  await runSqlFile("schema.sql");

  if (process.env.APPLY_SEED_DATA === "true") {
    await runSqlFile("seed.sql");
  }
}

main()
  .then(async () => {
    await db.end();
  })
  .catch(async (error) => {
    console.error("Database migration failed:", error);
    await db.end();
    process.exitCode = 1;
  });
