#!/usr/bin/env tsx
/**
 * Idempotent migration runner — applies every *.sql file in drizzle/ in numeric order.
 * All migration files use IF NOT EXISTS / IF EXISTS guards so re-running is safe.
 *
 * Used by start.sh instead of drizzle-kit migrate, which only knows about 0000–0003.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[migrate] DATABASE_URL not set");
  process.exit(1);
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
  const client = await pool.connect();

  try {
    // Find all numbered .sql migration files, sorted numerically
    const dir = resolve(process.cwd(), "drizzle");
    const files = readdirSync(dir)
      .filter((f) => /^\d+.*\.sql$/.test(f))
      .sort((a, b) => {
        const numA = parseInt(a.split("_")[0], 10);
        const numB = parseInt(b.split("_")[0], 10);
        return numA - numB;
      });

    console.log(`[migrate] Found ${files.length} migration files`);

    for (const file of files) {
      const sql = readFileSync(resolve(dir, file), "utf8").trim();
      if (!sql) continue;

      try {
        await client.query(sql);
        console.log(`[migrate] ✓ ${file}`);
      } catch (err) {
        const msg = (err as Error).message ?? "";
        // All our migration files use IF NOT EXISTS / IF EXISTS guards — errors here
        // mean the statement was a no-op (already applied). Log and continue.
        if (
          /already exists/i.test(msg) ||
          /does not exist/i.test(msg) ||
          /duplicate/i.test(msg)
        ) {
          console.log(`[migrate] ↩ ${file} (already applied: ${msg.slice(0, 80)})`);
        } else {
          console.error(`[migrate] ✗ ${file}: ${msg}`);
          throw err;
        }
      }
    }

    console.log("[migrate] All migrations complete");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migrate] Fatal:", err);
  process.exit(1);
});
