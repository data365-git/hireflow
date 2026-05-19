import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { users, userRoles, systemRoles } from "@/lib/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";
import { toResponse, HttpError } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission("settings", "delete");
    const { id } = await params;

    // Cannot self-delete
    if (id === session.sub) {
      return Response.json({ error: "Cannot delete yourself" }, { status: 400 });
    }

    const [targetUser] = await db.select().from(users).where(eq(users.id, id));
    if (!targetUser) throw new HttpError(404, "User not found");

    // Must be deactivated first
    if (targetUser.hasAccess) {
      return Response.json({ error: "User must have access revoked before permanent deletion" }, { status: 400 });
    }

    // Cannot delete superadmin
    const activeRoles = await db.select({ role: userRoles.role })
      .from(userRoles)
      .where(and(eq(userRoles.userId, id), eq(userRoles.isActive, true)));
    const roleNames = activeRoles.map(r => r.role);

    if (roleNames.length > 0) {
      const supers = await db.select({ name: systemRoles.name }).from(systemRoles)
        .where(and(eq(systemRoles.isSuperadmin, true), inArray(systemRoles.name, roleNames)));
      if (supers.length > 0) {
        return Response.json({ error: "Cannot permanently delete a superadmin" }, { status: 403 });
      }
    }

    // Cannot delete last admin
    if (roleNames.includes("admin")) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(userRoles)
        .where(and(eq(userRoles.isActive, true), eq(userRoles.role, "admin")));
      if (count <= 1) {
        return Response.json({ error: "Cannot delete the last admin" }, { status: 409 });
      }
    }

    // Audit BEFORE delete
    audit({
      action: "USER_DELETE",
      actorId: session.sub,
      actorEmail: session.email,
      entityType: "user",
      entityId: id,
      entityName: targetUser.fullName ?? targetUser.name,
      before: { email: targetUser.email, fullName: targetUser.fullName ?? targetUser.name },
    });

    await db.delete(users).where(eq(users.id, id));

    return Response.json({ ok: true });
  } catch (err) {
    return toResponse(err);
  }
}
