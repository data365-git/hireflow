import { db } from "@/lib/db/client";
import { refreshTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyRefreshToken } from "@/lib/auth/jwt";
import { verifyPassword } from "@/lib/auth/password";
import { clearAuthCookies, readRefreshCookie } from "@/lib/auth/cookies";
import { audit } from "@/lib/auth/audit";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  const cookieToken = await readRefreshCookie();

  if (cookieToken) {
    try {
      const { sub: userId } = await verifyRefreshToken(cookieToken);
      const rows = await db.select().from(refreshTokens).where(eq(refreshTokens.userId, userId));
      for (const r of rows) {
        if (await verifyPassword(cookieToken, r.token)) {
          await db.delete(refreshTokens).where(eq(refreshTokens.id, r.id));
          break;
        }
      }
    } catch {}
  }

  await clearAuthCookies();
  if (session) audit({ action: "LOGOUT", actorId: session.sub, actorEmail: session.email });
  return Response.json({ ok: true });
}
