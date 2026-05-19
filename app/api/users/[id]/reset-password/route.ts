import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { users, refreshTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";
import { toResponse, HttpError } from "@/lib/auth/session";
import { hashPassword, generateTempPassword } from "@/lib/auth/password";
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

    const temp = generateTempPassword();

    await db.update(users)
      .set({ passwordHash: await hashPassword(temp), adminPassword: temp, updatedAt: new Date() })
      .where(eq(users.id, id));

    await db.delete(refreshTokens).where(eq(refreshTokens.userId, id));

    audit({
      action: "PASSWORD_RESET",
      actorId: session.sub,
      actorEmail: session.email,
      entityType: "user",
      entityId: id,
      entityName: targetUser.fullName ?? targetUser.name,
    });

    return Response.json({ temporaryPassword: temp });
  } catch (err) {
    return toResponse(err);
  }
}
