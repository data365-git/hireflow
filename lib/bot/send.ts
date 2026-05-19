import { bot } from "./bot";

export async function sendBotMessage(telegramUserId: string, text: string) {
  return bot.api.sendMessage(telegramUserId, text, { parse_mode: "Markdown" });
}
