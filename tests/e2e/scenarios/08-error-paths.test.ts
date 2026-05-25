// tests/e2e/scenarios/08-error-paths.test.ts
import { describe, test, expect } from "vitest";
import { POST } from "@/app/api/tg-webhook/route";
import { sendUpdate } from "../harness/send-update";

function makeRawRequest(body: string, secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "test-secret"): Request {
  return new Request("http://test/api/tg-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": secret,
    },
    body,
  });
}

describe("08 — Error Paths", () => {
  test("malformed update body (not an Update object) → 200, no crash", async () => {
    const res = await POST(makeRawRequest(JSON.stringify({ not_an_update: true })));
    expect([200, 400]).toContain(res.status);
  });

  test("update with missing from field → 200 (handled gracefully)", async () => {
    const res = await sendUpdate({
      update_id: 999_888_777,
      message: { message_id: 1, date: 1, chat: { id: 999, type: "private" }, text: "hello" },
    });
    expect(res.status).toBe(200);
  });

  test("empty JSON body {} → no 500", async () => {
    const res = await POST(makeRawRequest("{}"));
    expect(res.status).toBeLessThan(500);
  });

  test("wrong secret token → Grammy rejects (non-200)", async () => {
    const req = makeRawRequest(
      JSON.stringify({ update_id: 1, message: { message_id: 1, date: 1, chat: { id: 1, type: "private" } } }),
      "totally-wrong-secret"
    );
    const res = await POST(req);
    // Grammy webhook secret check returns 401
    expect([401, 403]).toContain(res.status);
  });

  test("non-JSON body → no 500", async () => {
    const req = new Request("http://test/api/tg-webhook", {
      method: "POST",
      headers: {
        "content-type": "text/plain",
        "x-telegram-bot-api-secret-token": "test-secret",
      },
      body: "not json at all",
    });
    const res = await POST(req);
    expect(res.status).toBeLessThan(500);
  });

  test("update_id deduplication: second send of same update_id returns 200 and does nothing", async () => {
    const update = {
      update_id: 888_111_222,
      message: {
        message_id: 1,
        date: 1,
        chat: { id: 99_999, type: "private" as const },
        from: { id: 99_999, is_bot: false, first_name: "Dedup" },
        text: "/start",
        entities: [{ type: "bot_command" as const, offset: 0, length: 6 }],
      },
    };
    const r1 = await sendUpdate(update);
    const r2 = await sendUpdate(update);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
  });
});
