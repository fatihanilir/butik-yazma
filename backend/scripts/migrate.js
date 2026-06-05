import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query, pool } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }

  const migrationDir = path.resolve(__dirname, "../migrations");
  const migrationFiles = fs.readdirSync(migrationDir).filter((name) => name.endsWith(".sql")).sort();

  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationDir, file), "utf8");
    console.log(`[migrate] running ${file}`);
    await query(sql);
  }

  console.log(`[migrate] completed ${migrationFiles.length} file(s).`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
