import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { systemRoles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";
import { toResponse } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePermission("settings", "read");
    const all = await db.select().from(systemRoles);
    return Response.json(all);
  } catch (err) {
    return toResponse(err);
  }
}

const CreateBody = z.object({
  name: z.string().regex(/^[a-z0-9_-]+$/, "Role name must be lowercase slug: [a-z0-9_-]"),
  displayName: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("settings", "write");

    const parsed = CreateBody.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    const { name, displayName, description, color } = parsed.data;

    const existing = await db.select().from(systemRoles).where(eq(systemRoles.name, name));
    if (existing[0]) return Response.json({ error: "Role name already exists" }, { status: 409 });

    const id = crypto.randomUUID();
    await db.insert(systemRoles).values({
      id,
      name,
      displayName,
      description,
      color,
      isSystem: false,
      isSuperadmin: false,
    });

    audit({
      action: "ROLE_CREATE",
      actorId: session.sub,
      actorEmail: session.email,
      entityType: "role",
      entityId: id,
      entityName: name,
      after: { name, displayName, description, color },
    });

    return Response.json({ id, name, displayName });
  } catch (err) {
    return toResponse(err);
  }
}
