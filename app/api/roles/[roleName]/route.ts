import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { systemRoles, rolePermissions, userRoles } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";
import { toResponse, HttpError } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";
import { zodMessage } from "@/lib/auth/zod-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpdateBody = z.object({
  displayName: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  // name change is rejected
  name: z.undefined({ message: "Role name cannot be changed" }).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ roleName: string }> }
) {
  try {
    const session = await requirePermission("settings", "write");
    const { roleName } = await params;

    const body = await req.json();
    if ("name" in body) {
      return Response.json({ error: "Role name cannot be changed" }, { status: 400 });
    }

    const parsed = UpdateBody.safeParse(body);
    if (!parsed.success) return Response.json({ error: zodMessage(parsed.error) }, { status: 400 });
    const { displayName, description, color } = parsed.data;

    const [role] = await db.select().from(systemRoles).where(eq(systemRoles.name, roleName));
    if (!role) throw new HttpError(404, "Role not found");

    const updates: Partial<typeof systemRoles.$inferInsert> = { updatedAt: new Date() };
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    if (displayName !== undefined) { before.displayName = role.displayName; updates.displayName = displayName; after.displayName = displayName; }
    if (description !== undefined) { before.description = role.description; updates.description = description; after.description = description; }
    if (color !== undefined) { before.color = role.color; updates.color = color; after.color = color; }

    await db.update(systemRoles).set(updates).where(eq(systemRoles.name, roleName));

    audit({
      action: "ROLE_UPDATE",
      actorId: session.sub,
      actorEmail: session.email,
      entityType: "role",
      entityId: role.id,
      entityName: roleName,
      before,
      after,
    });

    return Response.json({ ok: true });
  } catch (err) {
    return toResponse(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ roleName: string }> }
) {
  try {
    const session = await requirePermission("settings", "delete");
    const { roleName } = await params;

    const [role] = await db.select().from(systemRoles).where(eq(systemRoles.name, roleName));
    if (!role) throw new HttpError(404, "Role not found");

    // Refuse system roles
    if (role.isSystem) {
      return Response.json({ error: "Cannot delete a system role" }, { status: 409 });
    }

    // Refuse if any users have this role active
    const activeUsers = await db.select().from(userRoles)
      .where(and(eq(userRoles.role, roleName), eq(userRoles.isActive, true)));
    if (activeUsers.length > 0) {
      return Response.json({ error: `Role is assigned to ${activeUsers.length} active user(s)` }, { status: 409 });
    }

    audit({
      action: "ROLE_DELETE",
      actorId: session.sub,
      actorEmail: session.email,
      entityType: "role",
      entityId: role.id,
      entityName: roleName,
      before: { name: roleName, displayName: role.displayName },
    });

    await db.delete(rolePermissions).where(eq(rolePermissions.role, roleName));
    await db.delete(systemRoles).where(eq(systemRoles.name, roleName));

    return Response.json({ ok: true });
  } catch (err) {
    return toResponse(err);
  }
}
