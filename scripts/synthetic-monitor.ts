// scripts/synthetic-monitor.ts
/**
 * Production synthetic monitor — verifies the bot's critical path is alive.
 *
 * Sends a real /start webhook to the production endpoint, then queries the DB
 * directly to verify the application row was created within 3 seconds.
 *
 * Identity: uses SYNTHETIC_TELEGRAM_USER_ID (a test Telegram account whitelisted
 * in bot_test_users). Bot-test users write to the demo partition, so synthetic
 * applications never appear in the live HR pipeline.
 *
 * Alert deduplication:
 *   - First failure → alert immediately.
 *   - Subsequent failures within 1 hour → suppress.
 *   - Recovery → alert once.
 *
 * Schedule: run every 15 minutes via Railway cron or GitHub Actions schedule.
 * Add to railway.json:
 *   { "deploy": { "cronJobs": [{ "schedule": "*/15 * * * *", "command": "tsx scripts/synthetic-monitor.ts" }] } }
 *
 * Required env vars (set in Railway prod service):
 *   SYNTHETIC_WEBHOOK_URL     — e.g. https://hireflow.up.railway.app/api/tg-webhook
 *   SYNTHETIC_TELEGRAM_USER_ID — Telegram user ID of the test account
 *   SYNTHETIC_VACANCY_ID      — ID of a permanent "Synthetic Monitor Test" vacancy
 *   TELEGRAM_WEBHOOK_SECRET   — same secret as production
 *   DATABASE_URL              — production database URL
 *   ALERT_WEBHOOK_URL         — Telegram sendMessage URL or Slack webhook (optional)
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";
import { writeFileSync, readFileSync, existsSync } from "fs";

const PROD_WEBHOOK_URL = process.env.SYNTHETIC_WEBHOOK_URL;
const SYNTHETIC_USER_ID = Number(process.env.SYNTHETIC_TELEGRAM_USER_ID);
const SYNTHETIC_VACANCY_ID = process.env.SYNTHETIC_VACANCY_ID;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;
const DB_URL = process.env.DATABASE_URL;
const STATE_FILE = "/tmp/synthetic-monitor-state.json";
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour between repeated failure alerts

if (!PROD_WEBHOOK_URL || !SYNTHETIC_USER_ID || !SYNTHETIC_VACANCY_ID || !WEBHOOK_SECRET || !DB_URL) {
  console.error(
    "[monitor] Missing required env vars: SYNTHETIC_WEBHOOK_URL, SYNTHETIC_TELEGRAM_USER_ID, " +
    "SYNTHETIC_VACANCY_ID, TELEGRAM_WEBHOOK_SECRET, DATABASE_URL"
  );
  process.exit(1);
}

type MonitorState = { lastAlertedAt: number; lastStatus: "ok" | "fail" };

function loadState(): MonitorState {
  if (!existsSync(STATE_FILE)) return { lastAlertedAt: 0, lastStatus: "ok" };
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")) as MonitorState; } catch { return { lastAlertedAt: 0, lastStatus: "ok" }; }
}

function saveState(s: MonitorState) {
  try { writeFileSync(STATE_FILE, JSON.stringify(s)); } catch { /* ephemeral fs may not be writable */ }
}

async function sendAlert(message: string) {
  if (!ALERT_WEBHOOK_URL) { console.warn("[monitor] ALERT_WEBHOOK_URL not set — alert suppressed"); return; }
  try {
    await fetch(ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
  } catch (err) {
    console.error("[monitor] alert delivery failed:", err);
  }
}

async function main() {
  const pool = new Pool({ connectionString: DB_URL!, max: 1 });
  const state = loadState();
  let ok = false;
  let errorDetail = "";

  try {
    // 1. Clean up any leftover application from a previous synthetic run
    await pool.query(
      `DELETE FROM applications
       WHERE candidate_id = (SELECT id FROM candidates WHERE telegram_user_id = $1 LIMIT 1)
         AND vacancy_id = $2`,
      [String(SYNTHETIC_USER_ID), SYNTHETIC_VACANCY_ID]
    );

    // 2. Send /start webhook to production
    const updateId = Date.now();
    const startPayload = {
      update_id: updateId,
      message: {
        message_id: updateId,
        date: Math.floor(Date.now() / 1000),
        chat: { id: SYNTHETIC_USER_ID, type: "private" },
        from: { id: SYNTHETIC_USER_ID, is_bot: false, first_name: "SyntheticMonitor" },
        text: `/start ${SYNTHETIC_VACANCY_ID}`,
        entities: [{ type: "bot_command", offset: 0, length: 6 }],
      },
    };

    const t0 = Date.now();
    const res = await fetch(PROD_WEBHOOK_URL!, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": WEBHOOK_SECRET!,
      },
      body: JSON.stringify(startPayload),
    });
    const latencyMs = Date.now() - t0;

    if (!res.ok) {
      errorDetail = `webhook returned HTTP ${res.status} (${latencyMs}ms)`;
    } else if (latencyMs > 10_000) {
      errorDetail = `webhook took ${latencyMs}ms — exceeded 10s budget`;
    } else {
      // 3. Verify the application row was created (allow 3s for async DB write)
      await new Promise((r) => setTimeout(r, 3_000));
      const rows = await pool.query(
        `SELECT a.id FROM applications a
         JOIN candidates c ON a.candidate_id = c.id
         WHERE c.telegram_user_id = $1 AND a.vacancy_id = $2`,
        [String(SYNTHETIC_USER_ID), SYNTHETIC_VACANCY_ID]
      );
      if ((rows.rowCount ?? 0) === 0) {
        errorDetail = "application row not found 3s after /start";
      } else {
        ok = true;
        console.log(`[monitor] ✓ ok — webhook=${latencyMs}ms`);
      }
    }
  } catch (err) {
    errorDetail = (err as Error).message;
  } finally {
    await pool.end().catch(() => {});
  }

  // 4. Alert with deduplication
  const isFailure = !ok;
  const timeSinceLastAlert = Date.now() - state.lastAlertedAt;
  const shouldAlert =
    (isFailure && timeSinceLastAlert > ALERT_COOLDOWN_MS) ||
    (!isFailure && state.lastStatus === "fail");

  if (shouldAlert) {
    const emoji = isFailure ? "🚨" : "✅";
    const msg = isFailure
      ? `${emoji} HireFlow synthetic monitor FAILED: ${errorDetail}`
      : `${emoji} HireFlow synthetic monitor RECOVERED`;
    await sendAlert(msg);
    saveState({ lastAlertedAt: Date.now(), lastStatus: isFailure ? "fail" : "ok" });
    console.log(`[monitor] alert sent: ${msg}`);
  } else {
    saveState({ ...state, lastStatus: isFailure ? "fail" : "ok" });
  }

  if (isFailure) {
    console.error(`[monitor] FAILED: ${errorDetail}`);
    process.exit(1);
  }
}

main().catch((err) => { console.error("[monitor] unhandled error:", err); process.exit(1); });
