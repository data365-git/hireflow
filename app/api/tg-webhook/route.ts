import { webhookCallback } from "grammy";
import { bot } from "@/lib/bot/bot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handleUpdate = webhookCallback(bot, "std/http", {
  secretToken: process.env.TELEGRAM_WEBHOOK_SECRET!,
});

export async function POST(req: Request) {
  try {
    return await handleUpdate(req);
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Error", { status: 500 });
  }
}
