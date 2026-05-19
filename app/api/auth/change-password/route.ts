import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { users, refreshTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession, toResponse, HttpError } from "@/lib/auth/session";
import { hashPassword, verifyPassword, PASSWORD_SCHEMA } from "@/lib/auth/password";
import { audit } from "@/lib/auth/audit";
import { zodMessage } from "@/lib/auth/zod-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  currentPassword: z.string().min(1),
  newPassword: PASSWORD_SCHEMA,
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new HttpError(401, "Unauthorized");

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: zodMessage(parsed.error) }, { status: 400 });
    const { currentPassword, newPassword } = parsed.data;

    if (currentPassword === newPassword) {
      return Response.json({ error: "New password must differ from current" }, { status: 400 });
    }

    const [user] = await db.select().from(users).where(eq(users.id, session.sub));
    if (!user) throw new HttpError(404, "User not found");

    const ok = await verifyPassword(currentPassword, user.passwordHash!);
    if (!ok) throw new HttpError(401, "Current password incorrect");

    await db.update(users)
      .set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    await db.delete(refreshTokens).where(eq(refreshTokens.userId, user.id));

    audit({ action: "PASSWORD_CHANGE", actorId: user.id, actorEmail: user.email! });

    return Response.json({ ok: true });
  } catch (err) {
    return toResponse(err);
  }
}
