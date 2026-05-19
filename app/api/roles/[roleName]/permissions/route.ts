import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { rolePermissions, systemRoles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";
import { toResponse, HttpError } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";
import { publish } from "@/lib/realtime/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roleName: string }> }
) {
  try {
    await requirePermission("settings", "read");
    const { roleName } = await params;

    const perms = await db.select().from(rolePermissions).where(eq(rolePermissions.role, roleName));
    return Response.json(perms);
  } catch (err) {
    return toResponse(err);
  }
}

const PermItem = z.object({
  screenName: z.string().min(1),
  canRead: z.boolean(),
  canCreate: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});
const PutBody = z.array(PermItem).min(1);

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ roleName: string }> }
) {
  try {
    const session = await requirePermission("settings", "write");
    const { roleName } = await params;

    const [role] = await db.select().from(systemRoles).where(eq(systemRoles.name, roleName));
    if (!role) throw new HttpError(404, "Role not found");

    const parsed = PutBody.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    const items = parsed.data;

    for (const item of items) {
      const canWrite = item.canCreate || item.canEdit;
      await db.insert(rolePermissions).values({
        id: crypto.randomUUID(),
        role: roleName,
        screenName: item.screenName,
        canRead: item.canRead,
        canCreate: item.canCreate,
        canEdit: item.canEdit,
        canDelete: item.canDelete,
        canWrite,
      }).onConflictDoUpdate({
        target: [rolePermissions.role, rolePermissions.screenName],
        set: {
          canRead: item.canRead,
          canCreate: item.canCreate,
          canEdit: item.canEdit,
          canDelete: item.canDelete,
          canWrite,
        },
      });
    }

    await publish("role-permissions", { type: "role-updated", role: roleName });

    audit({
      action: "PERMISSIONS_UPDATE",
      actorId: session.sub,
      actorEmail: session.email,
      entityType: "role",
      entityId: role.id,
      entityName: roleName,
      after: { permissions: items },
    });

    return Response.json({ ok: true });
  } catch (err) {
    return toResponse(err);
  }
}
