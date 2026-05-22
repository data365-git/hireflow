#!/usr/bin/env tsx
/**
 * Migration runner with explicit tracking.
 *
 * This file intentionally does NOT re-run every SQL file on every boot. Some
 * migrations contain data changes, so re-executing them can mutate production
 * data. Each file is applied once and then recorded in _migrations_applied.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createHash } from "crypto";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[migrate] DATABASE_URL not set");
  process.exit(1);
}

function checksum(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

function migrationNumber(file: string): number {
  return parseInt(file.split("_")[0], 10);
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
  const client = await pool.connect();

  let lockAcquired = false;

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations_applied (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now(),
        checksum text NOT NULL
      )
    `);
    await client.query("SELECT pg_advisory_lock(hashtext($1))", ["hr-app-migrations"]);
    lockAcquired = true;

    const dir = resolve(process.cwd(), "drizzle");
    const files = readdirSync(dir)
      .filter((f) => /^\d+.*\.sql$/.test(f))
      .sort((a, b) => {
        return migrationNumber(a) - migrationNumber(b) || a.localeCompare(b);
      });

    console.log(`[migrate] Found ${files.length} migration files`);

    const appliedCount = await client.query("SELECT count(*)::int AS count FROM _migrations_applied");
    const hasApplicationTable = await client.query("SELECT to_regclass('public.applications') AS name");
    if (appliedCount.rows[0]?.count === 0 && hasApplicationTable.rows[0]?.name) {
      const historicalFiles = files.filter((file) => migrationNumber(file) <= 18);
      for (const file of historicalFiles) {
        const sql = readFileSync(resolve(dir, file), "utf8").trim();
        await client.query(
          "INSERT INTO _migrations_applied (filename, checksum) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [file, checksum(sql)]
        );
      }
      console.log(`[migrate] Bootstrapped ${historicalFiles.length} historical migrations`);
    }

    for (const file of files) {
      const sql = readFileSync(resolve(dir, file), "utf8").trim();
      const digest = checksum(sql);

      const applied = await client.query(
        "SELECT checksum FROM _migrations_applied WHERE filename = $1",
        [file]
      );
      if (applied.rowCount && applied.rowCount > 0) {
        const previous = applied.rows[0]?.checksum;
        const changed = previous && previous !== digest ? ", checksum changed" : "";
        console.log(`[migrate] ↩ ${file} (already applied${changed})`);
        continue;
      }

      if (!sql) {
        await client.query(
          "INSERT INTO _migrations_applied (filename, checksum) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [file, digest]
        );
        console.log(`[migrate] ✓ ${file} (empty)`);
        continue;
      }

      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO _migrations_applied (filename, checksum) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [file, digest]
        );
        await client.query("COMMIT");
        console.log(`[migrate] ✓ ${file}`);
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        console.error(`[migrate] ✗ ${file}: ${(err as Error).message}`);
        throw err;
      }
    }

    console.log("[migrate] All migrations complete");
  } finally {
    if (lockAcquired) {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", ["hr-app-migrations"]).catch(() => {});
    }
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migrate] Fatal:", err);
  process.exit(1);
});
