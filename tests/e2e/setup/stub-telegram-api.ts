import { bot } from "@/lib/bot/bot";

export type SentMessage = { method: string; chatId: number | string; payload: unknown };

const sent: SentMessage[] = [];

export function stubTelegramApi() {
  const noop = (method: string) => async (...args: unknown[]) => {
    sent.push({ method, chatId: args[0] as string | number, payload: args.slice(1) });
    return { message_id: Math.floor(Math.random() * 1e9), ok: true };
  };
  // Replace bot.api with a recording proxy — never hits the real Telegram API
  (bot as unknown as { api: unknown }).api = new Proxy({} as Record<string, unknown>, {
    get(_target, prop: string) {
      return noop(prop);
    },
  });
}

export function getSentMessages(): SentMessage[] { return sent.slice(); }
export function clearSentMessages(): void { sent.length = 0; }
