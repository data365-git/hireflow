import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { users, userRoles, refreshTokens } from "@/lib/db/schema";
import { and, eq, lt } from "drizzle-orm";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { hashPassword, verifyPassword, EMAIL_SCHEMA } from "@/lib/auth/password";
import { setAuthCookies } from "@/lib/auth/cookies";
import { checkLoginRateLimit, recordLoginAttempt } from "@/lib/auth/rate-limit";
import { audit } from "@/lib/auth/audit";
import { zodMessage } from "@/lib/auth/zod-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ email: EMAIL_SCHEMA, password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const rl = await checkLoginRateLimit(ip);
  if (!rl.allowed) return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: zodMessage(parsed.error) }, { status: 400 });
  const { email, password } = parsed.data;

  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) {
    await recordLoginAttempt(ip, email, false);
    audit({ action: "LOGIN_FAILED", actorEmail: email, ip, description: "user not found" });
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (!user.hasAccess) {
    return Response.json({ error: "Access denied. Contact your administrator." }, { status: 403 });
  }

  const ok = await verifyPassword(password, user.passwordHash!);
  if (!ok) {
    await recordLoginAttempt(ip, email, false);
    audit({ action: "LOGIN_FAILED", actorId: user.id, actorEmail: email, ip });
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await recordLoginAttempt(ip, email, true);

  await db.delete(refreshTokens).where(
    and(eq(refreshTokens.userId, user.id), lt(refreshTokens.expiresAt, new Date()))
  );

  const roleRows = await db.select({ role: userRoles.role })
    .from(userRoles)
    .where(and(eq(userRoles.userId, user.id), eq(userRoles.isActive, true)));
  const roles = roleRows.map(r => r.role);

  const accessToken = await signAccessToken({ sub: user.id, email: user.email!, roles });
  const rawRefresh = await signRefreshToken(user.id);
  const refreshHash = await hashPassword(rawRefresh);

  await db.insert(refreshTokens).values({
    id: crypto.randomUUID(),
    userId: user.id,
    token: refreshHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  });

  await setAuthCookies(accessToken, rawRefresh);
  audit({ action: "LOGIN", actorId: user.id, actorEmail: user.email!, ip });

  return Response.json({
    accessToken,
    user: {
      id: user.id, email: user.email, fullName: user.fullName ?? user.name,
      avatarUrl: user.avatarUrl, phone: user.phone,
    },
  });
}
