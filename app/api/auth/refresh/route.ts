import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { users, userRoles, refreshTokens } from "@/lib/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/lib/auth/jwt";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { setAuthCookies, clearAuthCookies, readRefreshCookie } from "@/lib/auth/cookies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  const cookieToken = await readRefreshCookie();
  if (!cookieToken) return Response.json({ error: "No refresh token" }, { status: 401 });

  let userId: string;
  try {
    const verified = await verifyRefreshToken(cookieToken);
    userId = verified.sub;
  } catch {
    await clearAuthCookies();
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  // Find matching DB row by bcrypt comparison
  const rows = await db.select().from(refreshTokens)
    .where(and(eq(refreshTokens.userId, userId), gt(refreshTokens.expiresAt, new Date())));

  let matchedRow = null;
  for (const r of rows) {
    if (await verifyPassword(cookieToken, r.token)) {
      matchedRow = r;
      break;
    }
  }

  if (!matchedRow) {
    await clearAuthCookies();
    return Response.json({ error: "Token not found" }, { status: 401 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || !user.hasAccess) {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
    await clearAuthCookies();
    return Response.json({ error: "Access denied" }, { status: 403 });
  }

  // Rotate
  await db.delete(refreshTokens).where(eq(refreshTokens.id, matchedRow.id));

  const roleRows = await db.select({ role: userRoles.role })
    .from(userRoles)
    .where(and(eq(userRoles.userId, user.id), eq(userRoles.isActive, true)));
  const roles = roleRows.map(r => r.role);

  const newAccess = await signAccessToken({ sub: user.id, email: user.email!, roles });
  const newRefresh = await signRefreshToken(user.id);
  const newHash = await hashPassword(newRefresh);

  await db.insert(refreshTokens).values({
    id: crypto.randomUUID(),
    userId: user.id,
    token: newHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  });

  await setAuthCookies(newAccess, newRefresh);

  return Response.json({ accessToken: newAccess });
}
