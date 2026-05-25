// tests/e2e/setup/global-setup.ts
import { beforeAll, afterAll, beforeEach } from "vitest";
import { stubTelegramApi, clearSentMessages } from "./stub-telegram-api";
import { runMigrations, resetDb } from "./reset-db";
import { pool } from "@/lib/db/client";
import { _installTestSessionHook } from "@/lib/auth/session";

// Install a fixed admin session so all requirePermission() calls succeed.
// This runs at module evaluation time — before any test file imports server actions.
_installTestSessionHook(() => ({
  sub: "test-admin-id",
  email: "test@hireflow.test",
  roles: ["admin"],
  iat: 0,
  exp: 9_999_999_999,
}));

beforeAll(async () => {
  stubTelegramApi();
  await runMigrations();
}, 120_000);

beforeEach(async () => {
  await resetDb();
  clearSentMessages();
});

afterAll(async () => {
  _installTestSessionHook(null);
  await pool.end();
});
