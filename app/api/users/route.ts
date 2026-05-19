import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { users, userRoles, profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";
import { hashPassword, EMAIL_SCHEMA, PASSWORD_SCHEMA } from "@/lib/auth/password";
import { audit } from "@/lib/auth/audit";
import { toResponse } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePermission("settings", "read");

    const all = await db.select().from(users);
    const roleRows = await db.select().from(userRoles).where(eq(userRoles.isActive, true));

    const roleMap = new Map<string, string[]>();
    for (const r of roleRows) {
      if (!roleMap.has(r.userId)) roleMap.set(r.userId, []);
      roleMap.get(r.userId)!.push(r.role);
    }

    return Response.json(all.map(u => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName ?? u.name,
      avatarUrl: u.avatarUrl,
      phone: u.phone,
      isActive: u.isActive,
      hasAccess: u.hasAccess,
      adminPassword: u.adminPassword,
      roles: roleMap.get(u.id) ?? [],
      createdAt: u.createdAt,
    })));
  } catch (err) {
    return toResponse(err);
  }
}

const CreateBody = z.object({
  email: EMAIL_SCHEMA,
  password: z.string().optional(),
  fullName: z.string().min(1),
  phone: z.string().optional(),
  role: z.string().min(1),
  isActive: z.boolean().optional().default(true),
  hasAccess: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("settings", "write");

    const parsed = CreateBody.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    const { email, password, fullName, phone, role, isActive, hasAccess } = parsed.data;

    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing[0]) return Response.json({ error: "Email already exists" }, { status: 409 });

    const id = crypto.randomUUID();
    const initials = fullName.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();

    let pw: string;
    if (!hasAccess) {
      pw = crypto.randomUUID(); // unusable placeholder
    } else if (!password) {
      return Response.json({ error: "Password required when hasAccess=true" }, { status: 400 });
    } else {
      const valid = PASSWORD_SCHEMA.safeParse(password);
      if (!valid.success) return Response.json({ error: valid.error.flatten() }, { status: 400 });
      pw = password;
    }

    await db.insert(users).values({
      id,
      name: fullName,
      avatarInitials: initials,
      role,
      email,
      passwordHash: await hashPassword(pw),
      adminPassword: hasAccess ? pw : null,
      fullName,
      phone,
      isActive: isActive ?? true,
      hasAccess: hasAccess ?? true,
    });

    await db.insert(profiles).values({ id, fullName }).onConflictDoNothing();

    if (hasAccess) {
      await db.insert(userRoles).values({
        id: crypto.randomUUID(),
        userId: id,
        role,
        isActive: true,
        assignedBy: session.sub,
      });
    }

    audit({
      action: "USER_CREATE",
      actorId: session.sub,
      actorEmail: session.email,
      entityType: "user",
      entityId: id,
      entityName: fullName,
      after: { email, fullName, role },
    });

    return Response.json({ id, email, fullName, role });
  } catch (err) {
    return toResponse(err);
  }
}
