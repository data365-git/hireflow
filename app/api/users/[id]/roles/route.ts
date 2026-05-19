import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { users, userRoles, systemRoles, refreshTokens } from "@/lib/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";
import { toResponse, HttpError } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";
import { publish } from "@/lib/realtime/bus";
import { zodMessage } from "@/lib/auth/zod-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  roles: z.array(z.string().min(1)).min(1),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission("settings", "write");
    const { id } = await params;

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: zodMessage(parsed.error) }, { status: 400 });
    const { roles: newRoles } = parsed.data;

    const [targetUser] = await db.select().from(users).where(eq(users.id, id));
    if (!targetUser) throw new HttpError(404, "User not found");

    // Guard: don't remove last admin
    const currentAdminRoles = await db.select({ role: userRoles.role })
      .from(userRoles)
      .where(and(eq(userRoles.userId, id), eq(userRoles.isActive, true), eq(userRoles.role, "admin")));
    const isCurrentlyAdmin = currentAdminRoles.length > 0;

    if (isCurrentlyAdmin && !newRoles.includes("admin")) {
      // Count total active admins across all users
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(userRoles)
        .where(and(eq(userRoles.isActive, true), eq(userRoles.role, "admin")));
      if (count <= 1) {
        return Response.json({ error: "Cannot remove the last admin" }, { status: 409 });
      }
    }

    // Deactivate all current roles
    await db.update(userRoles)
      .set({ isActive: false })
      .where(eq(userRoles.userId, id));

    // Upsert new roles
    for (const role of newRoles) {
      await db.insert(userRoles).values({
        id: crypto.randomUUID(),
        userId: id,
        role,
        isActive: true,
        assignedBy: session.sub,
      }).onConflictDoUpdate({
        target: [userRoles.userId, userRoles.role],
        set: { isActive: true, assignedBy: session.sub, assignedAt: new Date() },
      });
    }

    // Also update the legacy role column on users (first role)
    if (newRoles.length > 0) {
      await db.update(users).set({ role: newRoles[0] }).where(eq(users.id, id));
    }

    // Invalidate sessions
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, id));

    // Publish realtime event
    await publish("role-permissions", { type: "user-role-assigned", userId: id });

    audit({
      action: "ROLE_ASSIGN",
      actorId: session.sub,
      actorEmail: session.email,
      entityType: "user",
      entityId: id,
      entityName: targetUser.fullName ?? targetUser.name,
      after: { roles: newRoles },
    });

    return Response.json({ ok: true, roles: newRoles });
  } catch (err) {
    return toResponse(err);
  }
}
