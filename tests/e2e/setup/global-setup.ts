// tests/e2e/setup/global-setup.ts
import { beforeAll, afterAll, beforeEach, vi } from "vitest";

// Stub out Telegram notifications — the test bot token isn't real so any call
// that creates a new Bot() instance would hit api.telegram.org and get a 404.
vi.mock("@/lib/bot/notifications", () => ({
  sendStageNotification: vi.fn().mockResolvedValue(undefined),
  sendStageNotificationToHr: vi.fn().mockResolvedValue(undefined),
  notifyActiveApplicationsVacancyClosed: vi.fn().mockResolvedValue(undefined),
}));
import { stubTelegramApi, clearSentMessages } from "./stub-telegram-api";
import { runMigrations, resetDb } from "./reset-db";
import { pool } from "@/lib/db/client";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { _installTestSessionHook } from "@/lib/auth/session";

const ADMIN_SESSION = () => ({
  sub: "test-admin-id",
  email: "test@hireflow.test",
  roles: ["admin"] as string[],
  iat: 0,
  exp: 9_999_999_999,
});

// Install now (covers first-file imports before beforeAll fires).
_installTestSessionHook(ADMIN_SESSION);

beforeAll(async () => {
  // Reinstall for each file — afterAll of the previous file may have cleared it.
  _installTestSessionHook(ADMIN_SESSION);
  stubTelegramApi();
  await runMigrations();
}, 120_000);

beforeEach(async () => {
  await resetDb();
  clearSentMessages();

  // Re-seed the test admin user after each reset. Server actions write session.sub
  // ("test-admin-id") into FK columns (e.g. vacancies.deleted_by, vacancy_status_changes.changed_by).
  // Without this row the FK constraint fires and actions return errors.
  await db.insert(users).values({
    id: "test-admin-id",
    name: "Test Admin",
    avatarInitials: "TA",
    role: "admin",
    email: "test@hireflow.test",
    passwordHash: "not-a-real-hash",
    isActive: true,
  }).onConflictDoNothing();
});

afterAll(async () => {
  // Don't null the hook here — the next file's beforeAll will reinstall it
  // before its tests run, and we don't want a window where it's null.
  // pool.end() is intentionally omitted: singleFork=true+fileParallelism=false
  // means Vitest ends the fork process after all files complete, which cleans
  // up pool connections implicitly.
});
