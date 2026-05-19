import { Bot } from "grammy";
import { handleStart, handleJobs, handleStatus, handleHelp, handleCancel, handleText, handleCallbackQuery } from "./handlers";

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set");
}

export const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

bot.command("start", handleStart);
bot.command("jobs", handleJobs);
bot.command("status", handleStatus);
bot.command("help", handleHelp);
bot.command("cancel", handleCancel);

bot.on("callback_query:data", handleCallbackQuery);
bot.on("message:document", handleText); // CV uploads
bot.on("message:text", handleText);

bot.catch((err) => {
  console.error(`[Bot Error] ${err.message}`);
});
