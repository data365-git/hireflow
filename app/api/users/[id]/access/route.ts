import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { users, userRoles, systemRoles, refreshTokens } from "@/lib/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";
import { toResponse, HttpError } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";
import { zodMessage } from "@/lib/auth/zod-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  hasAccess: z.boolean(),
  reason: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission("settings", "write");
    const { id } = await params;

    // Cannot self-revoke
    if (id === session.sub) {
      return Response.json({ error: "Cannot modify your own access" }, { status: 400 });
    }

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: zodMessage(parsed.error) }, { status: 400 });
    const { hasAccess, reason } = parsed.data;

    const [targetUser] = await db.select().from(users).where(eq(users.id, id));
    if (!targetUser) throw new HttpError(404, "User not found");

    // Cannot touch superadmin
    const activeRoles = await db.select({ role: userRoles.role })
      .from(userRoles)
      .where(and(eq(userRoles.userId, id), eq(userRoles.isActive, true)));
    const roleNames = activeRoles.map(r => r.role);

    if (roleNames.length > 0) {
      const supers = await db.select({ name: systemRoles.name }).from(systemRoles)
        .where(and(eq(systemRoles.isSuperadmin, true), inArray(systemRoles.name, roleNames)));
      if (supers.length > 0) {
        return Response.json({ error: "Cannot modify superadmin access" }, { status: 403 });
      }
    }

    // Guard: cannot revoke last admin
    if (!hasAccess && roleNames.includes("admin")) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(userRoles)
        .where(and(eq(userRoles.isActive, true), eq(userRoles.role, "admin")));
      if (count <= 1) {
        return Response.json({ error: "Cannot revoke the last admin's access" }, { status: 409 });
      }
    }

    if (!hasAccess) {
      // Revoke
      await db.update(users)
        .set({ hasAccess: false, isActive: false, deactivationReason: reason ?? null, updatedAt: new Date() })
        .where(eq(users.id, id));
      await db.delete(refreshTokens).where(eq(refreshTokens.userId, id));
      audit({ action: "ACCESS_REVOKED", actorId: session.sub, actorEmail: session.email, entityType: "user", entityId: id, entityName: targetUser.fullName ?? targetUser.name, description: reason });
    } else {
      // Restore
      await db.update(users)
        .set({ hasAccess: true, isActive: true, deactivationReason: null, updatedAt: new Date() })
        .where(eq(users.id, id));
      audit({ action: "ACCESS_RESTORED", actorId: session.sub, actorEmail: session.email, entityType: "user", entityId: id, entityName: targetUser.fullName ?? targetUser.name });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return toResponse(err);
  }
}
