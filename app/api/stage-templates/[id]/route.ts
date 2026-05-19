import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { stageTemplates, stageTemplateStages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";
import { toResponse, HttpError } from "@/lib/auth/session";
import { zodMessage } from "@/lib/auth/zod-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const StageBody = z.object({
  name: z.string().min(1),
  color: z.string().min(1),
  isFinal: z.boolean(),
  isRejected: z.boolean(),
  orderIndex: z.number().int(),
});

const UpdateBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  stages: z.array(StageBody).min(1).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("settings", "write");
    const { id } = await params;

    const [tpl] = await db.select().from(stageTemplates).where(eq(stageTemplates.id, id));
    if (!tpl) throw new HttpError(404, "Template not found");
    if (tpl.isSystem) return Response.json({ error: "Cannot edit a system template" }, { status: 403 });

    const parsed = UpdateBody.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: zodMessage(parsed.error) }, { status: 400 });
    const { name, description, stages } = parsed.data;

    const updates: Partial<typeof stageTemplates.$inferInsert> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;

    await db.update(stageTemplates).set(updates).where(eq(stageTemplates.id, id));

    if (stages !== undefined) {
      await db.delete(stageTemplateStages).where(eq(stageTemplateStages.templateId, id));
      for (const [i, stage] of stages.entries()) {
        await db.insert(stageTemplateStages).values({
          id: crypto.randomUUID(),
          templateId: id,
          name: stage.name,
          color: stage.color,
          isFinal: stage.isFinal,
          isRejected: stage.isRejected,
          orderIndex: stage.orderIndex ?? i,
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return toResponse(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("settings", "write");
    const { id } = await params;

    const [tpl] = await db.select().from(stageTemplates).where(eq(stageTemplates.id, id));
    if (!tpl) throw new HttpError(404, "Template not found");
    if (tpl.isSystem) return Response.json({ error: "Cannot delete a system template" }, { status: 403 });

    await db.delete(stageTemplates).where(eq(stageTemplates.id, id));

    return Response.json({ ok: true });
  } catch (err) {
    return toResponse(err);
  }
}
