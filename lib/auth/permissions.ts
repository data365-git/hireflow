import { db } from "@/lib/db/client";
import { rolePermissions, systemRoles } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { HttpError, requireSession } from "./session";

type Action = "read" | "write" | "create" | "edit" | "delete";

export async function requirePermission(screenName: string, action: Action) {
  const session = await requireSession();
  const roles = session.roles ?? [];

  if (roles.includes("admin")) return session;

  if (roles.length > 0) {
    const supers = await db
      .select({ name: systemRoles.name })
      .from(systemRoles)
      .where(and(eq(systemRoles.isSuperadmin, true), inArray(systemRoles.name, roles)));
    if (supers.length > 0) return session;
  }

  if (roles.length > 0) {
    const rows = await db
      .select()
      .from(rolePermissions)
      .where(and(inArray(rolePermissions.role, roles), eq(rolePermissions.screenName, screenName)));
    const allowed = rows.some((r) => {
      const write = r.canWrite || r.canCreate || r.canEdit;
      switch (action) {
        case "read":   return r.canRead;
        case "write":  return write;
        case "create": return r.canCreate || write;
        case "edit":   return r.canEdit   || write;
        case "delete": return r.canDelete;
      }
    });
    if (allowed) return session;
  }

  throw new HttpError(403, "Forbidden: insufficient permissions");
}
