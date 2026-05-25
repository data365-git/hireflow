// tests/e2e/setup/stub-telegram-api.ts
import { bot } from "@/lib/bot/bot";

export type SentMessage = { method: string; chatId: number | string; payload: unknown };

const sent: SentMessage[] = [];

export function stubTelegramApi() {
  // ── Per-update fetch interceptor ──────────────────────────────────────────
  // Grammy's handleUpdate creates a fresh Api instance per update using
  // bot.clientConfig as options. Setting a custom fetch here means ALL
  // ctx.reply / ctx.answerCallbackQuery / etc. calls are intercepted without
  // hitting the real api.telegram.org (which would 404 the test token).
  const customFetch = async (url: unknown, options: unknown) => {
    const urlStr = String(url);
    const match = urlStr.match(/\/bot[^/]+\/(\w+)/);
    const method = match?.[1] ?? "unknown";
    let payload: Record<string, unknown> = {};
    const opts = options as { body?: string };
    if (typeof opts?.body === "string") {
      try { payload = JSON.parse(opts.body); } catch { /* FormData or binary */ }
    }
    const chatId = (payload.chat_id ?? 0) as number | string;
    sent.push({ method, chatId, payload });
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: Math.floor(Math.random() * 1e9) } }),
    };
  };
  (bot as unknown as { clientConfig: unknown }).clientConfig = { fetch: customFetch };

  // ── bot.api Proxy ─────────────────────────────────────────────────────────
  // Grammy's handleUpdate also calls this.api.config.installedTransformers()
  // on the BOT's own api (not the per-update one) to copy the transformer
  // chain. The Proxy must return a proper config object.
  // Also handles bot.init() → bot.api.getMe() without a real network call.
  const stubConfig = {
    installedTransformers: () => [] as unknown[],
    use: (..._transformers: unknown[]) => {},
  };
  const noop = (method: string) => async (..._args: unknown[]) =>
    ({ ok: true, result: { message_id: Math.floor(Math.random() * 1e9) } });

  (bot as unknown as { api: unknown }).api = new Proxy({} as Record<string, unknown>, {
    get(_target, prop: string) {
      if (prop === "config") return stubConfig;
      return noop(prop);
    },
  });

  // ── bot.me ────────────────────────────────────────────────────────────────
  // Pre-set so bot.init() (called by webhookCallback on first request) finds
  // this.me !== undefined and skips the getMe() call entirely.
  (bot as unknown as { me: unknown }).me = {
    id: 123_456_789,
    is_bot: true,
    first_name: "HireFlow Test",
    username: "hireflow_test_bot",
  };
}

export function getSentMessages(): SentMessage[] { return sent.slice(); }

export function getSentMessagesFor(chatId: number): SentMessage[] {
  return sent.filter((m) => m.chatId === chatId || m.chatId === String(chatId));
}

export function clearSentMessages(): void { sent.length = 0; }

/** Assert the bot sent at least one message to chatId whose payload matches a regex/string. */
export function assertBotReplied(chatId: number, containing: string | RegExp): void {
  const messages = getSentMessagesFor(chatId);
  const pattern = typeof containing === "string" ? containing : containing;
  const found = messages.some((m) => {
    const s = JSON.stringify(m.payload);
    return typeof pattern === "string" ? s.includes(pattern) : pattern.test(s);
  });
  if (!found) {
    throw new Error(
      `Expected bot to reply to ${chatId} with payload matching ${String(containing)} but got:\n${JSON.stringify(messages, null, 2)}`
    );
  }
}
