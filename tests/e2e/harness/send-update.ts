import { POST } from "@/app/api/tg-webhook/route";

/** Submit a Telegram Update object directly to the webhook handler (no HTTP server needed) */
export async function sendUpdate(update: Record<string, unknown>): Promise<Response> {
  const req = new Request("http://test/api/tg-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": process.env.TELEGRAM_WEBHOOK_SECRET ?? "test-secret",
    },
    body: JSON.stringify(update),
  });
  return POST(req);
}
