import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";
import { toResponse, HttpError } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission("settings", "write");
    const { id } = await params;

    const [targetUser] = await db.select().from(users).where(eq(users.id, id));
    if (!targetUser) throw new HttpError(404, "User not found");

    await db.update(users)
      .set({ isActive: true, hasAccess: true, deactivationReason: null, updatedAt: new Date() })
      .where(eq(users.id, id));

    audit({
      action: "USER_REACTIVATE",
      actorId: session.sub,
      actorEmail: session.email,
      entityType: "user",
      entityId: id,
      entityName: targetUser.fullName ?? targetUser.name,
    });

    return Response.json({ ok: true });
  } catch (err) {
    return toResponse(err);
  }
}
