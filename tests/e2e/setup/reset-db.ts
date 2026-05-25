// tests/e2e/setup/reset-db.ts
import { pool } from "@/lib/db/client";
import { createHash } from "crypto";
import { resolve } from "path";
import { readFileSync, readdirSync } from "fs";

/**
 * Truncate all user-data tables using CASCADE on a minimal root set.
 * Avoids maintaining a full ordered list — CASCADE handles all children.
 */
const ROOT_TABLES = [
  "users",
  "candidates",
  "vacancies",
  "question_templates",
  "stage_templates",
  "bot_translations",
  "bot_content",
  "received_updates",
];

export async function resetDb(): Promise<void> {
  await pool.query(
    `TRUNCATE ${ROOT_TABLES.join(",")} RESTART IDENTITY CASCADE`
  );
}

function checksum(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function runMigrations(): Promise<void> {
  const dir = resolve(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((f) => /^\d+.*\.sql$/.test(f))
    .sort((a, b) => {
      const n = (f: string) => parseInt(f.split("_")[0], 10);
      return n(a) - n(b) || a.localeCompare(b);
    });

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations_applied (
        filename   text        PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now(),
        checksum   text        NOT NULL
      )
    `);

    for (const file of files) {
      const sql = readFileSync(resolve(dir, file), "utf8").trim();
      if (!sql) continue;
      const digest = checksum(sql);

      const applied = await client.query(
        "SELECT checksum FROM _migrations_applied WHERE filename = $1",
        [file]
      );
      if ((applied.rowCount ?? 0) > 0) continue;

      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO _migrations_applied (filename, checksum) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [file, digest]
        );
        await client.query("COMMIT");
        console.log(`[test-migrate] ✓ ${file}`);
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw new Error(`[test-migrate] ✗ ${file}: ${(err as Error).message}`);
      }
    }
  } finally {
    client.release();
  }
}
