import { db } from "@/lib/db/client";
import { users, userRoles, rolePermissions, systemRoles } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getSession, toResponse, HttpError } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new HttpError(401, "Unauthorized");

    const [user] = await db.select().from(users).where(eq(users.id, session.sub));
    if (!user) throw new HttpError(401, "User not found");
    if (!user.hasAccess) throw new HttpError(403, "Access denied");

    const roleRows = await db.select({ role: userRoles.role })
      .from(userRoles)
      .where(and(eq(userRoles.userId, user.id), eq(userRoles.isActive, true)));
    const roles = roleRows.map(r => r.role);

    let isSuperadmin = roles.includes("admin");
    let permissions: {
      role: string;
      screenName: string;
      canRead: boolean;
      canCreate: boolean;
      canEdit: boolean;
      canDelete: boolean;
      canWrite: boolean;
    }[] = [];

    try {
      if (roles.length > 0) {
        const supers = await db.select({ name: systemRoles.name }).from(systemRoles)
          .where(and(eq(systemRoles.isSuperadmin, true), inArray(systemRoles.name, roles)));
        if (supers.length > 0) isSuperadmin = true;

        const perms = await db.select().from(rolePermissions)
          .where(inArray(rolePermissions.role, roles));
        permissions = perms.map(p => ({
          role: p.role,
          screenName: p.screenName,
          canRead: p.canRead,
          canCreate: p.canCreate,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
          canWrite: p.canCreate || p.canEdit,
        }));
      }
    } catch (err) {
      console.error("Permission fetch failed (migration?):", err);
    }

    return Response.json({
      id: user.id,
      email: user.email,
      fullName: user.fullName ?? user.name,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      roles,
      isSuperadmin,
      permissions,
    });
  } catch (err) {
    return toResponse(err);
  }
}
