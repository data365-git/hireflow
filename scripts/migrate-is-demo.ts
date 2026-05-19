import { Pool } from "pg";
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = readFileSync(join(__dirname, "../drizzle/0004_add_is_demo.sql"), "utf8");
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log("Migration 0004 (is_demo) applied successfully");
  } catch (e) {
    console.error("Migration error:", e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
