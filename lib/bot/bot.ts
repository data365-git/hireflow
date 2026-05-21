import { Bot } from "grammy";
import { handleStart, handleJobs, handleStatus, handleHelp, handleCancel, handleBack, handleReset, handleTestReset, handleText, handleCallbackQuery, handlePhoto, handleContact } from "./handlers";
import { persistenceMiddleware } from "./middleware";
import { validateEnv } from "@/lib/env";

// Warn about missing env vars before the hard throw below, so logs show all missing vars at once
validateEnv();

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
bot.command("back", handleBack);
bot.command("reset", handleReset);
bot.command("testreset", handleTestReset);

bot.on("callback_query:data", handleCallbackQuery);
bot.on("message:photo", handlePhoto);
bot.on("message:contact", handleContact);
bot.on("message:document", handleText); // CV uploads (also saves inbound attachments outside flow)
bot.on("message:text", handleText);

bot.catch((err) => {
  console.error(`[Bot Error] ${err.message}`);
});
