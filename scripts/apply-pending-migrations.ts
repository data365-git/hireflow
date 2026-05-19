import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { readFileSync } from "fs";
import { resolve } from "path";
import { Pool } from "pg";

const PENDING = ["0004_add_is_demo.sql", "0005_drop_admin_password.sql", "0006_stage_templates.sql"];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    for (const f of PENDING) {
      const sql = readFileSync(resolve("drizzle", f), "utf8");
      console.log(`Applying ${f} ...`);
      try {
        await client.query(sql);
        console.log(`  ✓ ${f} applied`);
      } catch (err) {
        const msg = (err as Error).message;
        if (/already exists|does not exist/i.test(msg)) {
          console.log(`  ↩ ${f} skipped (already applied or no-op): ${msg.slice(0, 120)}`);
        } else {
          throw err;
        }
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
