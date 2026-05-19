import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { users, userRoles } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";
import { getSession, toResponse, HttpError } from "@/lib/auth/session";
import { hashPassword, verifyPassword, EMAIL_SCHEMA, PASSWORD_SCHEMA } from "@/lib/auth/password";
import { audit } from "@/lib/auth/audit";
import { zodMessage } from "@/lib/auth/zod-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("settings", "read");
    const { id } = await params;

    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user) throw new HttpError(404, "User not found");

    const roleRows = await db.select({ role: userRoles.role })
      .from(userRoles)
      .where(and(eq(userRoles.userId, id), eq(userRoles.isActive, true)));
    const roles = roleRows.map(r => r.role);

    return Response.json({
      id: user.id,
      email: user.email,
      fullName: user.fullName ?? user.name,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      isActive: user.isActive,
      hasAccess: user.hasAccess,
      roles,
      createdAt: user.createdAt,
    });
  } catch (err) {
    return toResponse(err);
  }
}

const PutBody = z.object({
  fullName: z.string().min(1).optional(),
  avatarUrl: z.string().url().optional(),
  phone: z.string().optional(),
  // Self password change via PUT (requires oldPassword)
  oldPassword: z.string().optional(),
  password: PASSWORD_SCHEMA.optional(),
  // Admin-only
  isActive: z.boolean().optional(),
  email: EMAIL_SCHEMA.optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) throw new HttpError(401, "Unauthorized");
    const { id } = await params;

    const isSelf = session.sub === id;
    const isAdmin = session.roles?.includes("admin");

    // Self can edit own profile; admin can edit any
    if (!isSelf && !isAdmin) {
      await requirePermission("settings", "write");
    }

    const parsed = PutBody.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: zodMessage(parsed.error) }, { status: 400 });
    const { fullName, avatarUrl, phone, oldPassword, password, isActive, email } = parsed.data;

    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user) throw new HttpError(404, "User not found");

    const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    if (fullName !== undefined) { before.fullName = user.fullName; updates.fullName = fullName; updates.name = fullName; after.fullName = fullName; }
    if (avatarUrl !== undefined) { before.avatarUrl = user.avatarUrl; updates.avatarUrl = avatarUrl; after.avatarUrl = avatarUrl; }
    if (phone !== undefined) { before.phone = user.phone; updates.phone = phone; after.phone = phone; }

    // Email update — admin only
    if (email !== undefined) {
      if (!isAdmin) throw new HttpError(403, "Only admins can change email");
      const conflict = await db.select().from(users).where(eq(users.email, email));
      if (conflict[0] && conflict[0].id !== id) return Response.json({ error: "Email already in use" }, { status: 409 });
      before.email = user.email;
      updates.email = email;
      after.email = email;
    }

    // isActive update — admin only
    if (isActive !== undefined) {
      if (!isAdmin) throw new HttpError(403, "Only admins can change isActive");
      before.isActive = user.isActive;
      updates.isActive = isActive;
      after.isActive = isActive;
    }

    // Password change
    if (password !== undefined) {
      if (!oldPassword) return Response.json({ error: "oldPassword required" }, { status: 400 });
      const ok = await verifyPassword(oldPassword, user.passwordHash!);
      if (!ok) throw new HttpError(401, "Current password incorrect");
      if (oldPassword === password) return Response.json({ error: "New password must differ from current" }, { status: 400 });
      updates.passwordHash = await hashPassword(password);
      after.passwordChanged = true;
    }

    if (Object.keys(updates).length > 1) {
      await db.update(users).set(updates).where(eq(users.id, id));
    }

    audit({ action: "USER_UPDATE", actorId: session.sub, actorEmail: session.email, entityType: "user", entityId: id, entityName: user.fullName ?? user.name, before, after });

    return Response.json({ ok: true });
  } catch (err) {
    return toResponse(err);
  }
}
