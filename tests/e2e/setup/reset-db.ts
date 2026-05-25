import { pool } from "@/lib/db/client";
import { resolve } from "path";
import { readFileSync, readdirSync } from "fs";

// Ordered by FK dependency — children first
const TABLES_IN_DEP_ORDER = [
  "received_updates",
  "audit_logs",
  "bot_messages",
  "screening_answers",
  "timeline_events",
  "applications",
  "screening_questions",
  "vacancy_stages",
  "sources",
  "vacancy_status_changes",
  "vacancies",
  "bot_sessions",
  "candidates",
  "departments",
  "user_roles",
  "users",
  "bot_translations",
  "bot_content",
  "question_template_items",
  "question_templates",
  "feedback",
];

export async function resetDb(): Promise<void> {
  // TRUNCATE … CASCADE handles any FKs we missed; RESTART IDENTITY resets sequences
  await pool.query(
    `TRUNCATE ${TABLES_IN_DEP_ORDER.join(",")} RESTART IDENTITY CASCADE`
  );
}

export async function runMigrations(): Promise<void> {
  const dir = resolve(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((f) => /^\d+.*\.sql$/.test(f))
    .sort();

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations_applied (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now(),
        checksum text NOT NULL
      )
    `);
    for (const file of files) {
      const sql = readFileSync(resolve(dir, file), "utf8").trim();
      if (!sql) continue;
      const applied = await client.query(
        "SELECT 1 FROM _migrations_applied WHERE filename = $1", [file]
      );
      if ((applied.rowCount ?? 0) > 0) continue;
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO _migrations_applied (filename, checksum) VALUES ($1, md5($1)) ON CONFLICT DO NOTHING",
        [file]
      );
      await client.query("COMMIT");
    }
  } finally {
    client.release();
  }
}
