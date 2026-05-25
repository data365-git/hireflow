// tests/e2e/setup/stub-telegram-api.ts
import { bot } from "@/lib/bot/bot";

export type SentMessage = { method: string; chatId: number | string; payload: unknown };

const sent: SentMessage[] = [];

export function stubTelegramApi() {
  const noop = (method: string) => async (...args: unknown[]) => {
    sent.push({ method, chatId: args[0] as string | number, payload: args.slice(1) });
    return { message_id: Math.floor(Math.random() * 1e9), ok: true, result: true };
  };
  (bot as unknown as { api: unknown }).api = new Proxy({} as Record<string, unknown>, {
    get(_target, prop: string) { return noop(prop); },
  });
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
