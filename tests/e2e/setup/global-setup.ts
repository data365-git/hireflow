import { beforeAll, afterAll, beforeEach } from "vitest";
import { stubTelegramApi, clearSentMessages } from "./stub-telegram-api";
import { runMigrations, resetDb } from "./reset-db";
import { pool } from "@/lib/db/client";

beforeAll(async () => {
  stubTelegramApi();
  await runMigrations();
}, 120_000);

beforeEach(async () => {
  await resetDb();
  clearSentMessages();
});

afterAll(async () => {
  await pool.end();
});
