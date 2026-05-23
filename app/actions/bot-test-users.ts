"use server";
import { db } from "@/lib/db/client";
import { botTestUsers } from "@/lib/db/schema";
import { and, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { revalidatePath } from "next/cache";

export type BotTestUser = {
  id: string;
  telegramUserId: string | null;
  telegramUsername: string | null;
  label: string | null;
  isActive: boolean;
  expiresAt: string | null;
  addedBy: string | null;
  addedAt: string;
};

export async function listBotTestUsers(): Promise<BotTestUser[]> {
  await requirePermission("settings", "read");
  const rows = await db.select().from(botTestUsers).orderBy(sql`added_at DESC`);
  return rows.map((r) => ({
    id: r.id,
    telegramUserId: r.telegramUserId,
    telegramUsername: r.telegramUsername,
    label: r.label,
    isActive: r.isActive,
    expiresAt: r.expiresAt?.toISOString() ?? null,
    addedBy: r.addedBy,
    addedAt: r.addedAt.toISOString(),
  }));
}

export async function addBotTestUser(input: {
  identifier: string;
  label?: string;
  expiresInDays?: number | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await requirePermission("settings", "write");

  const raw = input.identifier.trim().replace(/^@/, "");
  if (!raw) return { ok: false, error: "Enter a Telegram username (@name) or numeric user ID" };

  const isNumeric = /^\d{6,15}$/.test(raw);
  const telegramUserId = isNumeric ? raw : null;
  const telegramUsername = isNumeric ? null : raw.toLowerCase();

  const [{ c }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(botTestUsers)
    .where(eq(botTestUsers.isActive, true));
  if (c >= 20) {
    return { ok: false, error: "Max 20 active test users. Deactivate one first." };
  }

  const existing = await db
    .select({ id: botTestUsers.id })
    .from(botTestUsers)
    .where(
      or(
        telegramUserId ? eq(botTestUsers.telegramUserId, telegramUserId) : sql`false`,
        telegramUsername
          ? eq(sql`lower(${botTestUsers.telegramUsername})`, telegramUsername)
          : sql`false`,
      ),
    );
  if (existing[0]) {
    return { ok: false, error: "This Telegram user is already in the test list" };
  }

  const id = `btu-${crypto.randomUUID()}`;
  const expiresAt =
    input.expiresInDays != null
      ? new Date(Date.now() + input.expiresInDays * 86_400_000)
      : null;

  await db.insert(botTestUsers).values({
    id,
    telegramUserId,
    telegramUsername,
    label: input.label?.trim() || null,
    isActive: true,
    expiresAt,
    addedBy: session.sub,
  });

  audit({
    action: "BOT_TEST_USER_ADD",
    actorId: session.sub,
    actorEmail: session.email,
    entityType: "bot_test_user",
    entityId: id,
    entityName: input.label ?? telegramUsername ?? telegramUserId ?? "",
    after: { telegramUserId, telegramUsername, expiresAt },
  });

  revalidatePath("/settings/test-users");
  return { ok: true, id };
}

export async function toggleBotTestUser(id: string, isActive: boolean): Promise<{ ok: true }> {
  const session = await requirePermission("settings", "write");
  await db
    .update(botTestUsers)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(botTestUsers.id, id));
  audit({
    action: isActive ? "BOT_TEST_USER_ENABLE" : "BOT_TEST_USER_DISABLE",
    actorId: session.sub,
    actorEmail: session.email,
    entityType: "bot_test_user",
    entityId: id,
  });
  revalidatePath("/settings/test-users");
  return { ok: true };
}

export async function removeBotTestUser(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requirePermission("settings", "write");
  const [row] = await db.select().from(botTestUsers).where(eq(botTestUsers.id, id));
  if (!row) return { ok: false, error: "Not found" };

  audit({
    action: "BOT_TEST_USER_REMOVE",
    actorId: session.sub,
    actorEmail: session.email,
    entityType: "bot_test_user",
    entityId: id,
    entityName: row.label ?? row.telegramUsername ?? row.telegramUserId ?? "",
    before: { ...row, addedAt: row.addedAt.toISOString() },
  });

  await db.delete(botTestUsers).where(eq(botTestUsers.id, id));
  revalidatePath("/settings/test-users");
  return { ok: true };
}

/**
 * Called by the bot on every apply/reset interaction.
 * DB-first (active + non-expired), env-var fallback for resilience.
 * Side-effect: backfills numeric ID when row was added by username only.
 */
export async function isBotTestUser(opts: {
  telegramUserId: string;
  telegramUsername?: string | null;
}): Promise<boolean> {
  const username = opts.telegramUsername?.replace(/^@/, "").toLowerCase() ?? null;
  const now = new Date();

  const rows = await db
    .select()
    .from(botTestUsers)
    .where(
      and(
        eq(botTestUsers.isActive, true),
        or(isNull(botTestUsers.expiresAt), sql`${botTestUsers.expiresAt} > ${now}`),
        or(
          eq(botTestUsers.telegramUserId, opts.telegramUserId),
          username
            ? eq(sql`lower(${botTestUsers.telegramUsername})`, username)
            : sql`false`,
        ),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    const envIds = (process.env.BOT_ADMIN_TELEGRAM_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return envIds.includes(opts.telegramUserId);
  }

  const match = rows[0];
  if (!match.telegramUserId && opts.telegramUserId) {
    db.update(botTestUsers)
      .set({ telegramUserId: opts.telegramUserId, updatedAt: new Date() })
      .where(eq(botTestUsers.id, match.id))
      .catch((e) => console.error("[test-user] backfill failed", e));
  }

  return true;
}
