"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { messageTemplates } from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/permissions";

export type MessageTemplateKind = "intro" | "success" | string;

export type MessageTemplateView = {
  id: string;
  kind: string;
  name: string;
  content: string;
  isSystem: boolean;
  ownerId: string | null;
  isGlobal: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SaveMessageTemplateInput = {
  kind: MessageTemplateKind;
  name: string;
  content: string;
  isGlobal?: boolean;
};

function serializeTemplate(row: typeof messageTemplates.$inferSelect): MessageTemplateView {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    content: row.content,
    isSystem: row.isSystem,
    ownerId: row.ownerId,
    isGlobal: row.isGlobal,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function isAdminish(roles: string[] | undefined): boolean {
  return Boolean(roles?.some((role) => role === "admin" || role === "superadmin"));
}

export async function listMessageTemplates(kind?: MessageTemplateKind): Promise<MessageTemplateView[]> {
  const session = await requirePermission("settings", "read");
  const filters = [
    or(eq(messageTemplates.isGlobal, true), eq(messageTemplates.ownerId, session.sub)),
  ];
  if (kind) filters.push(eq(messageTemplates.kind, kind));

  const rows = await db
    .select()
    .from(messageTemplates)
    .where(and(...filters))
    .orderBy(asc(messageTemplates.kind), asc(messageTemplates.name));

  return rows.map(serializeTemplate);
}

export async function createMessageTemplate(input: SaveMessageTemplateInput): Promise<MessageTemplateView> {
  const session = await requirePermission("settings", "write");
  const name = input.name.trim();
  const content = input.content.trim();
  const kind = input.kind.trim();
  if (!kind) throw new Error("Template kind is required");
  if (!name) throw new Error("Template name is required");
  if (!content) throw new Error("Template content is required");

  const isGlobal = Boolean(input.isGlobal && isAdminish(session.roles));
  const [row] = await db
    .insert(messageTemplates)
    .values({
      id: `mt-${crypto.randomUUID()}`,
      kind,
      name,
      content,
      ownerId: session.sub,
      isGlobal,
      isSystem: false,
    })
    .returning();

  revalidatePath("/settings/message-templates");
  return serializeTemplate(row);
}

export async function updateMessageTemplate(
  id: string,
  patch: Partial<SaveMessageTemplateInput>
): Promise<MessageTemplateView> {
  const session = await requirePermission("settings", "write");
  const [existing] = await db.select().from(messageTemplates).where(eq(messageTemplates.id, id));
  if (!existing) throw new Error("Template not found");
  if (existing.isSystem) throw new Error("Cannot edit system templates");
  if (existing.ownerId !== session.sub && !isAdminish(session.roles)) {
    throw new Error("You can only edit your own templates");
  }

  const nextIsGlobal = patch.isGlobal === undefined
    ? existing.isGlobal
    : Boolean(patch.isGlobal && isAdminish(session.roles));

  const [row] = await db
    .update(messageTemplates)
    .set({
      kind: patch.kind?.trim() || existing.kind,
      name: patch.name?.trim() || existing.name,
      content: patch.content?.trim() || existing.content,
      isGlobal: nextIsGlobal,
      updatedAt: new Date(),
    })
    .where(eq(messageTemplates.id, id))
    .returning();

  revalidatePath("/settings/message-templates");
  return serializeTemplate(row);
}

export async function deleteMessageTemplate(id: string): Promise<void> {
  const session = await requirePermission("settings", "delete");
  const [existing] = await db.select().from(messageTemplates).where(eq(messageTemplates.id, id));
  if (!existing) return;
  if (existing.isSystem) throw new Error("Cannot delete system templates");
  if (existing.ownerId !== session.sub && !isAdminish(session.roles)) {
    throw new Error("You can only delete your own templates");
  }

  await db.delete(messageTemplates).where(eq(messageTemplates.id, id));
  revalidatePath("/settings/message-templates");
}
