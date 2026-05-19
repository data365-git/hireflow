import { Bot } from "grammy";
import { handleStart, handleJobs, handleStatus, handleHelp, handleCancel, handleText, handleCallbackQuery, handlePhoto } from "./handlers";
import { persistenceMiddleware } from "./middleware";

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set");
}

export const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

// Persist every event first
bot.use(persistenceMiddleware);

bot.command("start", handleStart);
bot.command("jobs", handleJobs);
bot.command("status", handleStatus);
bot.command("help", handleHelp);
bot.command("cancel", handleCancel);

bot.on("callback_query:data", handleCallbackQuery);
bot.on("message:photo", handlePhoto);
bot.on("message:document", handleText); // CV uploads (also saves inbound attachments outside flow)
bot.on("message:text", handleText);

bot.catch((err) => {
  console.error(`[Bot Error] ${err.message}`);
});
