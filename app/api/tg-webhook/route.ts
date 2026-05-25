import { webhookCallback } from "grammy";
import { bot } from "@/lib/bot/bot";
import { pool } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handleUpdate = webhookCallback(bot, "std/http", {
  secretToken: process.env.TELEGRAM_WEBHOOK_SECRET!,
});

export async function POST(req: Request) {
  // Deduplicate by update_id — Telegram retries if we don't respond within 10s
  let updateId: number | undefined;
  const cloned = req.clone();
  try {
    const body = await cloned.json() as { update_id?: number };
    updateId = body.update_id;
  } catch {
    // non-JSON body — fall through
  }

  if (updateId !== undefined) {
    try {
      const result = await pool.query(
        `INSERT INTO received_updates(update_id, received_at)
         VALUES ($1, NOW())
         ON CONFLICT(update_id) DO NOTHING
         RETURNING update_id`,
        [updateId]
      );
      if (result.rowCount === 0) {
        // Already processed this update — return 200 to stop Telegram retrying
        return new Response("OK", { status: 200 });
      }
    } catch (err) {
      // If dedup fails (e.g. table doesn't exist yet), still process the update
      console.warn("[webhook] dedup check failed:", err);
    }
  }

  try {
    return await handleUpdate(req);
  } catch (err) {
    // Standard practice: always return 200 so Telegram stops retrying.
    // The error is logged server-side for investigation.
    console.error("Webhook error:", err);
    return new Response("OK", { status: 200 });
  }
}
