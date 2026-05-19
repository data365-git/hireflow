import { Pool } from "pg";
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = readFileSync(join(__dirname, "../drizzle/0005_drop_admin_password.sql"), "utf8");
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log("Migration 0005 (drop admin_password) applied successfully");
  } catch (e) {
    console.error("Migration error:", e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}
main();
