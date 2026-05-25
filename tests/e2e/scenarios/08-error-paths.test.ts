import { describe, test, expect } from "vitest";
import { sendUpdate } from "../harness/send-update";

describe("08 — Error Paths", () => {
  test("bot receives malformed update body → 200 with no crash", async () => {
    const req = new Request("http://test/api/tg-webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": process.env.TELEGRAM_WEBHOOK_SECRET ?? "test-secret",
      },
      body: JSON.stringify({ not_an_update: true }),
    });
    const { POST } = await import("@/app/api/tg-webhook/route");
    const res = await POST(req);
    // Should not throw or return 500
    expect([200, 400]).toContain(res.status);
  });

  test("update with missing from field is handled gracefully", async () => {
    const res = await sendUpdate({
      update_id: 999_888_777,
      message: { message_id: 1, date: 1, chat: { id: 999, type: "private" }, text: "hello" },
      // missing: from field
    });
    expect(res.status).toBe(200);
  });

  test("empty body → no crash", async () => {
    const req = new Request("http://test/api/tg-webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "test-secret",
      },
      body: "{}",
    });
    const { POST } = await import("@/app/api/tg-webhook/route");
    const res = await POST(req);
    expect(res.status).toBeLessThan(500);
  });
});
